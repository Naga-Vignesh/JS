import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Minus, Plus, Trash2, X } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";

export default function MiniCart() {
  const { user } = useAuth();
  const [cart, setCart] = useState(null);
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchCart = async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/cart");
      setCart(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchCart();
    const interval = setInterval(fetchCart, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [user]);

  // Listen for cart-updated events
  useEffect(() => {
    const handler = () => fetchCart();
    window.addEventListener("cart-updated", handler);
    return () => window.removeEventListener("cart-updated", handler);
    // eslint-disable-next-line
  }, [user]);

  const updateQty = async (productId, qty) => {
    setUpdating(true);
    try {
      if (qty <= 0) {
        await api.delete(`/cart/items/${productId}`);
      } else {
        await api.put(`/cart/items/${productId}`, { quantity: qty });
      }
      await fetchCart();
      window.dispatchEvent(new Event("cart-updated"));
    } catch { /* ignore */ }
    setUpdating(false);
  };

  const itemCount = cart?.item_count || 0;

  if (!user) return null;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) fetchCart(); }}
        className="relative p-2 hover:bg-white/5 rounded-sm transition-colors"
        data-testid="mini-cart-toggle"
      >
        <ShoppingCart className="w-5 h-5 text-white" />
        {itemCount > 0 && (
          <Badge className="absolute -top-1 -right-1 bg-[#D4AF37] text-[#1A1A1A] text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center font-mono">
            {itemCount}
          </Badge>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#2A2A2A] border border-white/10 rounded-sm shadow-2xl z-50" data-testid="mini-cart-dropdown">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h4 className="text-sm font-semibold text-white">Cart ({itemCount})</h4>
            <button onClick={() => setOpen(false)} data-testid="mini-cart-close">
              <X className="w-4 h-4 text-white/40 hover:text-white" />
            </button>
          </div>

          {!cart?.items?.length ? (
            <div className="p-6 text-center text-white/40 text-sm">Your cart is empty</div>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto">
                {cart.items.map((item) => (
                  <div key={item.product_id} className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5">
                    <img src={item.image_url} alt="" className="w-10 h-10 object-cover rounded-sm bg-[#333]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{item.name}</p>
                      <p className="text-[10px] font-mono text-white/40">${item.unit_price?.toFixed(2)} x {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.product_id, item.quantity - 1)} disabled={updating} className="p-0.5 hover:bg-white/10 rounded">
                        {item.quantity <= 1 ? <Trash2 className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-white/60" />}
                      </button>
                      <span className="text-xs font-mono text-white w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product_id, item.quantity + 1)} disabled={updating} className="p-0.5 hover:bg-white/10 rounded">
                        <Plus className="w-3 h-3 text-white/60" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-white/10">
                <div className="flex justify-between mb-3">
                  <span className="text-sm text-white/60">Subtotal</span>
                  <span className="text-sm font-mono font-semibold text-[#D4AF37]">${cart.subtotal?.toFixed(2)}</span>
                </div>
                <Link to="/cart" onClick={() => setOpen(false)}>
                  <Button className="w-full bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#e6c24d] rounded-sm text-xs h-8 font-semibold" data-testid="mini-cart-view-cart">
                    VIEW CART & CHECKOUT
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
