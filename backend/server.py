from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, Request, HTTPException, Query
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, uuid, re, math
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import httpx

ROOT_DIR = Path(__file__).parent
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'fallback_secret_change_me')
JWT_ALGORITHM = "HS256"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ PYDANTIC MODELS ============
class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    company_name: Optional[str] = ""
    role: Optional[str] = "business_customer"

class UserLogin(BaseModel):
    email: str
    password: str

class ProductCreate(BaseModel):
    name: str
    sku: str
    category: str
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    base_price: float
    unit: str = "each"
    pricing_tiers: Optional[list] = []
    stock_quantity: int = 100
    low_stock_threshold: int = 10
    is_active: bool = True

class CartItemAdd(BaseModel):
    product_id: str
    quantity: int

class OrderCreate(BaseModel):
    delivery_date: str
    notes: Optional[str] = ""

class SessionRequest(BaseModel):
    session_id: str

# ============ AUTH HELPERS ============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(request: Request):
    try:
        return await get_current_user(request)
    except Exception:
        return None

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def set_auth_cookies(response, access_token, refresh_token):
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")

def get_stock_status(qty, threshold):
    if qty <= 0:
        return "out_of_stock"
    if qty <= threshold:
        return "low_stock"
    return "in_stock"

def calculate_tier_price(base_price, tiers, quantity):
    if not tiers:
        return base_price
    for tier in sorted(tiers, key=lambda t: t.get("min_qty", 0)):
        if quantity >= tier.get("min_qty", 0) and quantity <= tier.get("max_qty", 999999):
            return tier.get("price", base_price)
    return base_price

# ============ AUTH ROUTES ============
@api_router.post("/auth/register")
async def register(data: UserRegister):
    email = data.email.lower().strip()
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name,
        "company_name": data.company_name or "",
        "role": data.role if data.role in ["business_customer"] else "business_customer",
        "auth_provider": "local",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    access_token = create_access_token(user_id, email, user_doc["role"])
    refresh_token = create_refresh_token(user_id)
    user_response = {k: v for k, v in user_doc.items() if k not in ["password_hash", "_id"]}
    response = JSONResponse(content={"user": user_response, "access_token": access_token})
    set_auth_cookies(response, access_token, refresh_token)
    return response

@api_router.post("/auth/login")
async def login(data: UserLogin):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Please login with Google")
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access_token = create_access_token(user["user_id"], email, user["role"])
    refresh_token = create_refresh_token(user["user_id"])
    user_response = {k: v for k, v in user.items() if k != "password_hash"}
    response = JSONResponse(content={"user": user_response, "access_token": access_token})
    set_auth_cookies(response, access_token, refresh_token)
    return response

@api_router.post("/auth/logout")
async def logout():
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return response

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return {"user": user}

@api_router.post("/auth/refresh")
async def refresh_token(request: Request):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access_token = create_access_token(user["user_id"], user["email"], user["role"])
        response = JSONResponse(content={"access_token": access_token})
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
        return response
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# Google Auth via Emergent
# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
@api_router.post("/auth/session")
async def google_auth_session(data: SessionRequest):
    try:
        async with httpx.AsyncClient() as http_client:
            resp = await http_client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": data.session_id}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            session_data = resp.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Auth service unavailable")

    email = session_data["email"].lower()
    name = session_data.get("name", "")
    picture = session_data.get("picture", "")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "company_name": "",
            "role": "business_customer",
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})
        user = await db.users.find_one({"email": email}, {"_id": 0})

    user.pop("password_hash", None)
    access_token = create_access_token(user["user_id"], email, user["role"])
    refresh_token = create_refresh_token(user["user_id"])
    response = JSONResponse(content={"user": user, "access_token": access_token})
    set_auth_cookies(response, access_token, refresh_token)
    return response

# ============ PRODUCT ROUTES ============
@api_router.get("/products/categories")
async def get_categories():
    categories = await db.products.distinct("category")
    return {"categories": categories}

@api_router.get("/products")
async def list_products(
    request: Request,
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    availability: Optional[str] = None,
    sort: Optional[str] = "name",
    page: int = 1,
    limit: int = 20
):
    query = {"is_active": True}
    if category:
        query["category"] = category
    if search:
        escaped = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": escaped, "$options": "i"}},
            {"sku": {"$regex": escaped, "$options": "i"}},
            {"category": {"$regex": escaped, "$options": "i"}},
            {"description": {"$regex": escaped, "$options": "i"}}
        ]
    if min_price is not None:
        query["base_price"] = query.get("base_price", {})
        query["base_price"]["$gte"] = min_price
    if max_price is not None:
        query["base_price"] = query.get("base_price", {})
        query["base_price"]["$lte"] = max_price
    if availability == "in_stock":
        query["stock_quantity"] = {"$gt": 0}
    elif availability == "out_of_stock":
        query["stock_quantity"] = {"$lte": 0}

    sort_map = {
        "name": ("name", 1), "price_low": ("base_price", 1),
        "price_high": ("base_price", -1), "newest": ("created_at", -1)
    }
    sort_field, sort_dir = sort_map.get(sort, ("name", 1))

    total = await db.products.count_documents(query)
    skip = (page - 1) * limit
    products = await db.products.find(query, {"_id": 0}).sort(sort_field, sort_dir).skip(skip).limit(limit).to_list(limit)

    for p in products:
        p["stock_status"] = get_stock_status(p.get("stock_quantity", 0), p.get("low_stock_threshold", 10))

    # Apply customer pricing if logged in
    user = await get_optional_user(request)
    if user:
        custom_pricing = await db.customer_pricing.find(
            {"user_id": user["user_id"]}, {"_id": 0}
        ).to_list(1000)
        pricing_map = {cp["product_id"]: cp for cp in custom_pricing}
        for p in products:
            if p["product_id"] in pricing_map:
                cp = pricing_map[p["product_id"]]
                p["custom_price"] = cp.get("custom_price")
                if cp.get("custom_tiers"):
                    p["pricing_tiers"] = cp["custom_tiers"]

    return {
        "products": products,
        "total": total,
        "page": page,
        "pages": math.ceil(total / limit) if total > 0 else 1
    }

@api_router.get("/products/featured")
async def get_featured_products(request: Request):
    products = await db.products.find(
        {"is_active": True, "stock_quantity": {"$gt": 0}},
        {"_id": 0}
    ).sort("stock_quantity", -1).limit(8).to_list(8)
    for p in products:
        p["stock_status"] = get_stock_status(p.get("stock_quantity", 0), p.get("low_stock_threshold", 10))
    return {"products": products}

@api_router.get("/products/{product_id}")
async def get_product(product_id: str, request: Request):
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product["stock_status"] = get_stock_status(product.get("stock_quantity", 0), product.get("low_stock_threshold", 10))

    user = await get_optional_user(request)
    if user:
        cp = await db.customer_pricing.find_one(
            {"user_id": user["user_id"], "product_id": product_id}, {"_id": 0}
        )
        if cp:
            product["custom_price"] = cp.get("custom_price")
            if cp.get("custom_tiers"):
                product["pricing_tiers"] = cp["custom_tiers"]
    return {"product": product}

@api_router.post("/products")
async def create_product(data: ProductCreate, request: Request):
    await require_admin(request)
    product_id = f"prod_{uuid.uuid4().hex[:10]}"
    product_doc = {
        "product_id": product_id,
        **data.model_dump(),
        "stock_status": get_stock_status(data.stock_quantity, data.low_stock_threshold),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    if not product_doc["pricing_tiers"]:
        bp = data.base_price
        product_doc["pricing_tiers"] = [
            {"min_qty": 1, "max_qty": 10, "price": bp},
            {"min_qty": 11, "max_qty": 50, "price": round(bp * 0.9, 2)},
            {"min_qty": 51, "max_qty": 999999, "price": round(bp * 0.8, 2)}
        ]
    await db.products.insert_one(product_doc)
    product_doc.pop("_id", None)
    return {"product": product_doc}

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, request: Request):
    await require_admin(request)
    body = await request.json()
    body.pop("product_id", None)
    body.pop("_id", None)
    if "stock_quantity" in body:
        body["stock_status"] = get_stock_status(body["stock_quantity"], body.get("low_stock_threshold", 10))
    result = await db.products.update_one({"product_id": product_id}, {"$set": body})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    return {"product": product}

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, request: Request):
    await require_admin(request)
    result = await db.products.delete_one({"product_id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

# ============ CART ROUTES ============
@api_router.get("/cart")
async def get_cart(request: Request):
    user = await get_current_user(request)
    cart = await db.carts.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not cart:
        return {"items": [], "subtotal": 0, "item_count": 0}

    enriched_items = []
    subtotal = 0
    for item in cart.get("items", []):
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if product:
            tier_price = calculate_tier_price(product["base_price"], product.get("pricing_tiers", []), item["quantity"])
            line_total = round(tier_price * item["quantity"], 2)
            enriched_items.append({
                "product_id": item["product_id"],
                "quantity": item["quantity"],
                "name": product["name"],
                "sku": product["sku"],
                "image_url": product.get("image_url", ""),
                "unit": product.get("unit", "each"),
                "unit_price": tier_price,
                "base_price": product["base_price"],
                "line_total": line_total,
                "stock_quantity": product.get("stock_quantity", 0),
                "stock_status": get_stock_status(product.get("stock_quantity", 0), product.get("low_stock_threshold", 10))
            })
            subtotal += line_total

    return {"items": enriched_items, "subtotal": round(subtotal, 2), "item_count": len(enriched_items)}

@api_router.post("/cart/items")
async def add_to_cart(data: CartItemAdd, request: Request):
    user = await get_current_user(request)
    product = await db.products.find_one({"product_id": data.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.get("stock_quantity", 0) <= 0:
        raise HTTPException(status_code=400, detail="Product out of stock")
    if data.quantity > product.get("stock_quantity", 0):
        raise HTTPException(status_code=400, detail=f"Only {product['stock_quantity']} available")

    cart = await db.carts.find_one({"user_id": user["user_id"]})
    if not cart:
        await db.carts.insert_one({
            "user_id": user["user_id"],
            "items": [{"product_id": data.product_id, "quantity": data.quantity}],
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
    else:
        existing = next((i for i in cart["items"] if i["product_id"] == data.product_id), None)
        if existing:
            new_qty = existing["quantity"] + data.quantity
            if new_qty > product.get("stock_quantity", 0):
                raise HTTPException(status_code=400, detail=f"Only {product['stock_quantity']} available")
            await db.carts.update_one(
                {"user_id": user["user_id"], "items.product_id": data.product_id},
                {"$set": {"items.$.quantity": new_qty, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            await db.carts.update_one(
                {"user_id": user["user_id"]},
                {"$push": {"items": {"product_id": data.product_id, "quantity": data.quantity}},
                 "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
            )
    return {"message": "Item added to cart"}

@api_router.put("/cart/items/{product_id}")
async def update_cart_item(product_id: str, request: Request):
    user = await get_current_user(request)
    body = await request.json()
    quantity = body.get("quantity", 1)
    if quantity <= 0:
        await db.carts.update_one(
            {"user_id": user["user_id"]},
            {"$pull": {"items": {"product_id": product_id}}}
        )
        return {"message": "Item removed"}
    product = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if product and quantity > product.get("stock_quantity", 0):
        raise HTTPException(status_code=400, detail=f"Only {product['stock_quantity']} available")
    await db.carts.update_one(
        {"user_id": user["user_id"], "items.product_id": product_id},
        {"$set": {"items.$.quantity": quantity, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Cart updated"}

@api_router.delete("/cart/items/{product_id}")
async def remove_cart_item(product_id: str, request: Request):
    user = await get_current_user(request)
    await db.carts.update_one(
        {"user_id": user["user_id"]},
        {"$pull": {"items": {"product_id": product_id}},
         "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Item removed"}

@api_router.delete("/cart")
async def clear_cart(request: Request):
    user = await get_current_user(request)
    await db.carts.delete_one({"user_id": user["user_id"]})
    return {"message": "Cart cleared"}

# ============ ORDER ROUTES ============
MINIMUM_ORDER_VALUE = 50.0

@api_router.post("/orders")
async def create_order(data: OrderCreate, request: Request):
    user = await get_current_user(request)
    cart = await db.carts.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")

    order_items = []
    subtotal = 0
    for item in cart["items"]:
        product = await db.products.find_one({"product_id": item["product_id"]}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {item['product_id']} not found")
        if product.get("stock_quantity", 0) < item["quantity"]:
            raise HTTPException(status_code=400, detail=f"{product['name']} has insufficient stock")
        tier_price = calculate_tier_price(product["base_price"], product.get("pricing_tiers", []), item["quantity"])
        line_total = round(tier_price * item["quantity"], 2)
        order_items.append({
            "product_id": item["product_id"],
            "name": product["name"],
            "sku": product["sku"],
            "unit": product.get("unit", "each"),
            "quantity": item["quantity"],
            "unit_price": tier_price,
            "line_total": line_total,
            "image_url": product.get("image_url", "")
        })
        subtotal += line_total
        # Decrement stock
        await db.products.update_one(
            {"product_id": item["product_id"]},
            {"$inc": {"stock_quantity": -item["quantity"]}}
        )

    if subtotal < MINIMUM_ORDER_VALUE:
        raise HTTPException(status_code=400, detail=f"Minimum order value is ${MINIMUM_ORDER_VALUE:.2f}")

    order_id = f"ord_{uuid.uuid4().hex[:10]}"
    order_doc = {
        "order_id": order_id,
        "user_id": user["user_id"],
        "user_name": user.get("name", ""),
        "user_email": user.get("email", ""),
        "company_name": user.get("company_name", ""),
        "items": order_items,
        "subtotal": round(subtotal, 2),
        "status": "confirmed",
        "delivery_date": data.delivery_date,
        "notes": data.notes or "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order_doc)
    await db.carts.delete_one({"user_id": user["user_id"]})
    order_doc.pop("_id", None)
    return {"order": order_doc}

@api_router.get("/orders")
async def list_orders(request: Request, page: int = 1, limit: int = 20):
    user = await get_current_user(request)
    query = {"user_id": user["user_id"]}
    total = await db.orders.count_documents(query)
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"orders": orders, "total": total, "page": page, "pages": math.ceil(total/limit) if total > 0 else 1}

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, request: Request):
    user = await get_current_user(request)
    order = await db.orders.find_one({"order_id": order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"order": order}

@api_router.post("/orders/{order_id}/reorder")
async def reorder(order_id: str, request: Request):
    user = await get_current_user(request)
    order = await db.orders.find_one({"order_id": order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    cart = await db.carts.find_one({"user_id": user["user_id"]})
    items = []
    for oi in order["items"]:
        product = await db.products.find_one({"product_id": oi["product_id"]}, {"_id": 0})
        if product and product.get("stock_quantity", 0) > 0:
            qty = min(oi["quantity"], product["stock_quantity"])
            items.append({"product_id": oi["product_id"], "quantity": qty})

    if not items:
        raise HTTPException(status_code=400, detail="No items available for reorder")

    if cart:
        await db.carts.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"items": items, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        await db.carts.insert_one({
            "user_id": user["user_id"],
            "items": items,
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
    return {"message": "Items added to cart", "items_added": len(items)}

# ============ SEARCH ROUTES ============
SYNONYMS = {
    "cheese": ["dairy", "cheddar", "parmesan", "mozzarella"],
    "dairy": ["cheese", "cream", "milk", "eggs", "butter"],
    "meat": ["beef", "chicken", "pork", "lamb", "steak", "poultry"],
    "fish": ["seafood", "salmon", "tuna", "shrimp", "scallops"],
    "seafood": ["fish", "salmon", "tuna", "shrimp", "scallops"],
    "vegetable": ["produce", "greens", "tomato", "potato", "onion"],
    "produce": ["vegetable", "fruit", "greens"],
    "grain": ["rice", "flour", "bread", "pasta", "quinoa"],
    "oil": ["olive", "truffle", "condiment", "vinegar"],
}

@api_router.get("/search")
async def search_products(q: str = "", limit: int = 10):
    if not q.strip():
        popular = await db.products.find({"is_active": True}, {"_id": 0}).sort("stock_quantity", -1).limit(6).to_list(6)
        return {"results": popular, "suggestions": ["Premium Meats", "Fresh Seafood", "Organic Produce"]}

    terms = [q.strip()]
    q_lower = q.strip().lower()
    for key, syns in SYNONYMS.items():
        if q_lower in key or key in q_lower:
            terms.extend(syns)
        for s in syns:
            if q_lower in s or s in q_lower:
                terms.append(key)
                terms.extend(syns)

    terms = list(set(terms))
    regex_pattern = "|".join(re.escape(t) for t in terms)
    query = {
        "is_active": True,
        "$or": [
            {"name": {"$regex": regex_pattern, "$options": "i"}},
            {"sku": {"$regex": regex_pattern, "$options": "i"}},
            {"category": {"$regex": regex_pattern, "$options": "i"}},
            {"description": {"$regex": regex_pattern, "$options": "i"}}
        ]
    }
    results = await db.products.find(query, {"_id": 0}).limit(limit).to_list(limit)
    for r in results:
        r["stock_status"] = get_stock_status(r.get("stock_quantity", 0), r.get("low_stock_threshold", 10))

    suggestions = []
    if not results:
        all_cats = await db.products.distinct("category")
        suggestions = all_cats[:5]

    return {"results": results, "suggestions": suggestions}

# ============ ADMIN ROUTES ============
@api_router.get("/admin/analytics")
async def get_analytics(request: Request):
    await require_admin(request)
    total_products = await db.products.count_documents({"is_active": True})
    total_orders = await db.orders.count_documents({})
    total_customers = await db.users.count_documents({"role": {"$ne": "admin"}})
    low_stock = await db.products.count_documents({"stock_quantity": {"$lte": 10, "$gt": 0}})
    out_of_stock = await db.products.count_documents({"stock_quantity": {"$lte": 0}})

    # Revenue
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$subtotal"}}}]
    rev_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = rev_result[0]["total"] if rev_result else 0

    # Top products
    top_pipeline = [
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "name": {"$first": "$items.name"}, "total_qty": {"$sum": "$items.quantity"}, "total_revenue": {"$sum": "$items.line_total"}}},
        {"$sort": {"total_revenue": -1}},
        {"$limit": 10}
    ]
    top_products = await db.orders.aggregate(top_pipeline).to_list(10)

    # Recent orders by day
    recent_pipeline = [
        {"$addFields": {"date": {"$substr": ["$created_at", 0, 10]}}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}, "revenue": {"$sum": "$subtotal"}}},
        {"$sort": {"_id": -1}},
        {"$limit": 30}
    ]
    daily_stats = await db.orders.aggregate(recent_pipeline).to_list(30)

    return {
        "total_products": total_products,
        "total_orders": total_orders,
        "total_customers": total_customers,
        "total_revenue": round(total_revenue, 2),
        "low_stock_count": low_stock,
        "out_of_stock_count": out_of_stock,
        "top_products": top_products,
        "daily_stats": daily_stats
    }

@api_router.get("/admin/orders")
async def admin_list_orders(request: Request, status: Optional[str] = None, page: int = 1, limit: int = 20):
    await require_admin(request)
    query = {}
    if status:
        query["status"] = status
    total = await db.orders.count_documents(query)
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"orders": orders, "total": total, "page": page, "pages": math.ceil(total/limit) if total > 0 else 1}

@api_router.put("/admin/orders/{order_id}/status")
async def update_order_status(order_id: str, request: Request):
    await require_admin(request)
    body = await request.json()
    new_status = body.get("status")
    if new_status not in ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    result = await db.orders.update_one({"order_id": order_id}, {"$set": {"status": new_status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"message": "Status updated"}

@api_router.get("/admin/customers")
async def admin_list_customers(request: Request, page: int = 1, limit: int = 20):
    await require_admin(request)
    query = {"role": {"$ne": "admin"}}
    total = await db.users.count_documents(query)
    customers = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip((page-1)*limit).limit(limit).to_list(limit)
    return {"customers": customers, "total": total}

@api_router.get("/admin/inventory")
async def admin_inventory(request: Request):
    await require_admin(request)
    products = await db.products.find({"is_active": True}, {"_id": 0}).sort("stock_quantity", 1).to_list(1000)
    for p in products:
        p["stock_status"] = get_stock_status(p.get("stock_quantity", 0), p.get("low_stock_threshold", 10))
    return {"products": products}

@api_router.put("/admin/inventory/{product_id}")
async def update_inventory(product_id: str, request: Request):
    await require_admin(request)
    body = await request.json()
    stock_qty = body.get("stock_quantity")
    if stock_qty is None:
        raise HTTPException(status_code=400, detail="stock_quantity required")
    threshold = body.get("low_stock_threshold", 10)
    await db.products.update_one(
        {"product_id": product_id},
        {"$set": {"stock_quantity": stock_qty, "low_stock_threshold": threshold,
                  "stock_status": get_stock_status(stock_qty, threshold)}}
    )
    return {"message": "Inventory updated"}

# ============ SEED DATA ============
SEED_PRODUCTS = [
    {"name": "USDA Prime Ribeye Steak", "sku": "MEAT-001", "category": "Meat & Poultry", "description": "Premium USDA Prime grade ribeye, perfect marbling for exceptional flavor", "base_price": 24.99, "unit": "lb", "stock_quantity": 150, "image_url": "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=600"},
    {"name": "Boneless Chicken Breast", "sku": "MEAT-002", "category": "Meat & Poultry", "description": "Fresh boneless skinless chicken breast, hormone-free", "base_price": 8.49, "unit": "lb", "stock_quantity": 300, "image_url": "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=600"},
    {"name": "Ground Beef 80/20", "sku": "MEAT-003", "category": "Meat & Poultry", "description": "Fresh ground beef with ideal fat ratio for burgers and sauces", "base_price": 6.99, "unit": "lb", "stock_quantity": 200, "image_url": "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=600"},
    {"name": "Atlantic Salmon Fillet", "sku": "SEA-001", "category": "Seafood", "description": "Wild-caught Atlantic salmon, rich in omega-3", "base_price": 18.99, "unit": "lb", "stock_quantity": 80, "image_url": "https://images.unsplash.com/photo-1574781330855-d0db8cc6a79c?w=600"},
    {"name": "Jumbo Tiger Shrimp", "sku": "SEA-002", "category": "Seafood", "description": "Wild-caught jumbo tiger shrimp, shell-on, 16/20 count", "base_price": 22.99, "unit": "lb", "stock_quantity": 60, "image_url": "https://images.unsplash.com/photo-1565680018093-ebb6486d309f?w=600"},
    {"name": "Yellowfin Tuna Steak", "sku": "SEA-003", "category": "Seafood", "description": "Sushi-grade yellowfin tuna steaks", "base_price": 28.99, "unit": "lb", "stock_quantity": 5, "image_url": "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=600"},
    {"name": "Aged White Cheddar", "sku": "DAI-001", "category": "Dairy & Eggs", "description": "18-month aged white cheddar, sharp and creamy", "base_price": 12.99, "unit": "lb", "stock_quantity": 120, "image_url": "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=600"},
    {"name": "Heavy Whipping Cream", "sku": "DAI-002", "category": "Dairy & Eggs", "description": "Fresh heavy cream, 36% butterfat", "base_price": 4.99, "unit": "qt", "stock_quantity": 200, "image_url": "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=600"},
    {"name": "Farm Fresh Eggs (30ct)", "sku": "DAI-003", "category": "Dairy & Eggs", "description": "Free-range farm eggs, large grade AA", "base_price": 8.99, "unit": "case", "stock_quantity": 0, "image_url": "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600"},
    {"name": "Organic Mixed Greens", "sku": "PRD-001", "category": "Fresh Produce", "description": "Organic spring mix with arugula, spinach, and radicchio", "base_price": 5.99, "unit": "lb", "stock_quantity": 100, "image_url": "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600"},
    {"name": "Roma Tomatoes", "sku": "PRD-002", "category": "Fresh Produce", "description": "Vine-ripened roma tomatoes, perfect for sauces", "base_price": 3.49, "unit": "lb", "stock_quantity": 250, "image_url": "https://images.unsplash.com/photo-1546470427-0d4db154ceb8?w=600"},
    {"name": "Yukon Gold Potatoes", "sku": "PRD-003", "category": "Fresh Produce", "description": "Premium Yukon Gold potatoes, creamy texture", "base_price": 2.99, "unit": "lb", "stock_quantity": 400, "image_url": "https://images.unsplash.com/photo-1518977676601-b53f82ber40?w=600"},
    {"name": "Arborio Risotto Rice", "sku": "DRY-001", "category": "Dry Goods", "description": "Italian Arborio rice, ideal for creamy risottos", "base_price": 4.49, "unit": "lb", "stock_quantity": 300, "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600"},
    {"name": "All-Purpose Flour (50lb)", "sku": "DRY-002", "category": "Dry Goods", "description": "Professional-grade unbleached all-purpose flour", "base_price": 18.99, "unit": "bag", "stock_quantity": 80, "image_url": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600"},
    {"name": "Dried Black Beans", "sku": "DRY-003", "category": "Dry Goods", "description": "Premium dried black beans, high protein", "base_price": 2.99, "unit": "lb", "stock_quantity": 350, "image_url": "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=600"},
    {"name": "Extra Virgin Olive Oil", "sku": "OIL-001", "category": "Oils & Condiments", "description": "Cold-pressed Italian extra virgin olive oil", "base_price": 14.99, "unit": "gal", "stock_quantity": 90, "image_url": "https://images.unsplash.com/photo-1474979266404-7eabd7a11645?w=600"},
    {"name": "Aged Balsamic Vinegar", "sku": "OIL-002", "category": "Oils & Condiments", "description": "12-year aged Modena balsamic vinegar", "base_price": 12.99, "unit": "bottle", "stock_quantity": 120, "image_url": "https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=600"},
    {"name": "Black Truffle Oil", "sku": "OIL-003", "category": "Oils & Condiments", "description": "Premium black truffle infused olive oil", "base_price": 24.99, "unit": "bottle", "stock_quantity": 8, "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600"},
    {"name": "Premium French Fries", "sku": "FRZ-001", "category": "Frozen", "description": "Crispy-cut frozen french fries, restaurant quality", "base_price": 8.99, "unit": "case", "stock_quantity": 200, "image_url": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600"},
    {"name": "Mixed Berry Blend", "sku": "FRZ-002", "category": "Frozen", "description": "IQF mixed berries: strawberries, blueberries, raspberries", "base_price": 12.99, "unit": "case", "stock_quantity": 150, "image_url": "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=600"},
    {"name": "All-Butter Puff Pastry", "sku": "FRZ-003", "category": "Frozen", "description": "French-style all-butter puff pastry sheets", "base_price": 16.99, "unit": "case", "stock_quantity": 70, "image_url": "https://images.unsplash.com/photo-1555507036-ab1f4038024a?w=600"},
    {"name": "Artisan Sourdough Loaf", "sku": "BAK-001", "category": "Bakery & Grains", "description": "Freshly baked artisan sourdough bread", "base_price": 6.99, "unit": "each", "stock_quantity": 50, "image_url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600"},
    {"name": "Brioche Burger Buns (12ct)", "sku": "BAK-002", "category": "Bakery & Grains", "description": "Golden brioche buns, perfect for gourmet burgers", "base_price": 8.99, "unit": "pack", "stock_quantity": 100, "image_url": "https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=600"},
    {"name": "Flour Tortillas (50ct)", "sku": "BAK-003", "category": "Bakery & Grains", "description": "Soft flour tortillas, 10-inch, restaurant pack", "base_price": 12.99, "unit": "pack", "stock_quantity": 180, "image_url": "https://images.unsplash.com/photo-1627735747039-3b4c7e34e520?w=600"},
]

async def seed_products():
    count = await db.products.count_documents({})
    if count == 0:
        for p in SEED_PRODUCTS:
            product_id = f"prod_{p['sku'].lower().replace('-', '_')}"
            bp = p["base_price"]
            doc = {
                "product_id": product_id,
                "name": p["name"],
                "sku": p["sku"],
                "category": p["category"],
                "description": p["description"],
                "image_url": p.get("image_url", ""),
                "base_price": bp,
                "unit": p["unit"],
                "pricing_tiers": [
                    {"min_qty": 1, "max_qty": 10, "price": bp},
                    {"min_qty": 11, "max_qty": 50, "price": round(bp * 0.9, 2)},
                    {"min_qty": 51, "max_qty": 999999, "price": round(bp * 0.8, 2)}
                ],
                "stock_quantity": p["stock_quantity"],
                "low_stock_threshold": 10,
                "is_active": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.products.insert_one(doc)
        logger.info(f"Seeded {len(SEED_PRODUCTS)} products")

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@silvert.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "SilvertAdmin2024!")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        user_id = f"user_admin_{uuid.uuid4().hex[:8]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "company_name": "Silvert Supply Co.",
            "role": "admin",
            "auth_provider": "local",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )
        logger.info("Admin password updated")

    # Write test credentials
    memory_dir = Path("memory")
    memory_dir.mkdir(parents=True, exist_ok=True)

    with open(memory_dir / "test_credentials.md", "w") as f:
    f.write(f"# Test Credentials\n\n")
    f.write(f"## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n")
    f.write(f"## Test Business Customer\n- Email: chef@testrestaurant.com\n- Password: ChefTest2024!\n- Role: business_customer\n\n")
    f.write(f"## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n- POST /api/auth/session (Google Auth)\n")
async def seed_test_customer():
    email = "chef@testrestaurant.com"
    existing = await db.users.find_one({"email": email})
    if not existing:
        user_id = f"user_test_{uuid.uuid4().hex[:8]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "password_hash": hash_password("ChefTest2024!"),
            "name": "Chef Mario",
            "company_name": "Mario's Italian Kitchen",
            "role": "business_customer",
            "auth_provider": "local",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Test customer created: {email}")

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.products.create_index("product_id", unique=True)
    await db.products.create_index("sku")
    await db.products.create_index("category")
    await db.products.create_index([("name", 1)])
    await db.carts.create_index("user_id", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.orders.create_index("user_id")
    await seed_admin()
    await seed_test_customer()
    await seed_products()
    logger.info("Server started, indexes created, data seeded")

@app.on_event("shutdown")
async def shutdown():
    client.close()

# Include router
app.include_router(api_router)

# CORS - handle both development and production
frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
origins = [frontend_url, "http://localhost:3000"]
cors_raw = os.environ.get("CORS_ORIGINS", "")
if cors_raw and cors_raw != "*":
    origins.extend([o.strip() for o in cors_raw.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
