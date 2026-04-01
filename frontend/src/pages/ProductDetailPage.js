import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingCart, AlertTriangle, Minus, Plus, Package } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { toast } from "sonner";

export default function ProductDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/products/${id}`);
        setProduct(data.product);
      } catch {
        navigate("/products");
      }
      setLoading(false);
    })();
  }, [id, navigate]);

  const addToCart = async () => {
    if (!user) { navigate("/login"); return; }
    setAdding(true);
    try {
      await api.post("/cart/items", { product_id: product.product_id, quantity });
      window.dispatchEvent(new Event("cart-updated"));
      toast.success(`${product.name} added to cart`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add");
    }
    setAdding(false);
  };

  const getCurrentTierPrice = () => {
    if (!product?.pricing_tiers?.length) return product?.base_price || 0;
    for (const tier of product.pricing_tiers) {
      if (quantity >= tier.min_qty && quantity <= tier.max_qty) return tier.price;
    }
    return product.base_price;
  };

  if (loading) return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!product) return null;

  const isOut = product.stock_status === "out_of_stock";
  const isLow = product.stock_status === "low_stock";
  const tierPrice = getCurrentTierPrice();
  const lineTotal = (tierPrice * quantity).toFixed(2);

  return (
    <div className="bg-[#1A1A1A] min-h-screen" data-testid="product-detail-page">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-white/40 hover:text-white text-xs mb-6 -ml-2 h-8" data-testid="back-button">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image */}
          <div className="aspect-square bg-[#242424] border border-white/10 rounded-sm overflow-hidden">
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1495195134817-aeb325a55b65?w=600"; }}
            />
          </div>

          {/* Details */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-white/40" data-testid="product-sku">{product.sku}</span>
                <Badge className="text-[10px] bg-white/5 text-white/40 border-white/10">{product.category}</Badge>
              </div>
              <h1 className="text-3xl font-black text-white" style={{ fontFamily: 'Chivo' }} data-testid="product-name">{product.name}</h1>
              <p className="text-sm text-white/50 mt-3">{product.description}</p>
            </div>

            {/* Stock Status */}
            <div data-testid="stock-status">
              {isOut ? (
                <Badge variant="destructive" className="text-xs">OUT OF STOCK</Badge>
              ) : isLow ? (
                <Badge className="bg-orange-600/20 text-orange-400 text-xs flex items-center gap-1 w-fit">
                  <AlertTriangle className="w-3 h-3" /> Only {product.stock_quantity} left in stock
                </Badge>
              ) : (
                <Badge className="bg-[#2E7D32]/20 text-[#4CAF50] text-xs flex items-center gap-1 w-fit">
                  <Package className="w-3 h-3" /> In Stock
                </Badge>
              )}
            </div>

            {/* Price display */}
            <div className="bg-[#242424] border border-white/10 rounded-sm p-4">
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-mono font-bold text-[#D4AF37]" data-testid="product-price">${tierPrice.toFixed(2)}</span>
                <span className="text-sm text-white/40 mb-1">/{product.unit}</span>
              </div>
              {tierPrice < product.base_price && (
                <p className="text-xs text-[#4CAF50]">Volume discount applied! (was ${product.base_price.toFixed(2)})</p>
              )}
            </div>

            {/* Bulk Pricing Table */}
            {product.pricing_tiers?.length > 0 && (
              <div data-testid="bulk-pricing-table">
                <h3 className="text-xs font-semibold text-white/60 mb-2 tracking-widest">BULK PRICING</h3>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-white/40 text-xs h-8">Quantity</TableHead>
                      <TableHead className="text-white/40 text-xs h-8">Price per {product.unit}</TableHead>
                      <TableHead className="text-white/40 text-xs h-8">Savings</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.pricing_tiers.map((tier, i) => {
                      const isActive = quantity >= tier.min_qty && quantity <= tier.max_qty;
                      const savings = product.base_price > tier.price ? Math.round((1 - tier.price / product.base_price) * 100) : 0;
                      return (
                        <TableRow key={i} className={`border-white/5 ${isActive ? "bg-[#D4AF37]/5" : "hover:bg-white/5"}`}>
                          <TableCell className="font-mono text-xs text-white py-2">
                            {tier.min_qty} - {tier.max_qty >= 999999 ? "+" : tier.max_qty} units
                          </TableCell>
                          <TableCell className="font-mono text-xs py-2">
                            <span className={isActive ? "text-[#D4AF37] font-semibold" : "text-white/60"}>
                              ${tier.price.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs py-2">
                            {savings > 0 ? (
                              <Badge className="bg-[#2E7D32]/20 text-[#4CAF50] text-[10px]">{savings}% OFF</Badge>
                            ) : (
                              <span className="text-white/30">Base</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Quantity + Add to Cart */}
            {!isOut && (
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-white/10 rounded-sm">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-2 hover:bg-white/5 transition-colors"
                    data-testid="qty-decrease"
                  >
                    <Minus className="w-4 h-4 text-white/60" />
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 text-center bg-transparent text-white font-mono text-sm border-x border-white/10 py-2 focus:outline-none"
                    data-testid="qty-input"
                    min="1"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-2 hover:bg-white/5 transition-colors"
                    data-testid="qty-increase"
                  >
                    <Plus className="w-4 h-4 text-white/60" />
                  </button>
                </div>

                <Button
                  onClick={addToCart}
                  disabled={adding}
                  className="flex-1 bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#e6c24d] rounded-sm font-semibold h-10"
                  data-testid="add-to-cart-button"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {adding ? "Adding..." : `ADD TO CART - $${lineTotal}`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
