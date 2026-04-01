import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trash2, Minus, Plus, ArrowRight, ShoppingCart, AlertTriangle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import api from "../lib/api";
import { toast } from "sonner";

const MINIMUM_ORDER = 50;

export default function CartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState({});

  const fetchCart = useCallback(async () => {
    try {
      const { data } = await api.get("/cart");
      setCart(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const updateQty = async (productId, qty) => {
    setUpdating((p) => ({ ...p, [productId]: true }));
    try {
      if (qty <= 0) {
        await api.delete(`/cart/items/${productId}`);
        toast.success("Item removed");
      } else {
        await api.put(`/cart/items/${productId}`, { quantity: qty });
      }
      await fetchCart();
      window.dispatchEvent(new Event("cart-updated"));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    }
    setUpdating((p) => ({ ...p, [productId]: false }));
  };

  const removeItem = async (productId) => {
    setUpdating((p) => ({ ...p, [productId]: true }));
    try {
      await api.delete(`/cart/items/${productId}`);
      await fetchCart();
      window.dispatchEvent(new Event("cart-updated"));
      toast.success("Item removed");
    } catch { /* ignore */ }
    setUpdating((p) => ({ ...p, [productId]: false }));
  };

  const clearCart = async () => {
    try {
      await api.delete("/cart");
      await fetchCart();
      window.dispatchEvent(new Event("cart-updated"));
      toast.success("Cart cleared");
    } catch { /* ignore */ }
  };

  const belowMin = cart && cart.subtotal < MINIMUM_ORDER && cart.items?.length > 0;

  if (loading) return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="bg-[#1A1A1A] min-h-screen" data-testid="cart-page">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-black text-white mb-6" style={{ fontFamily: 'Chivo' }}>
          <ShoppingCart className="w-6 h-6 inline mr-2 text-[#D4AF37]" /> Shopping Cart
        </h1>

        {!cart?.items?.length ? (
          <div className="text-center py-16 bg-[#242424] border border-white/10 rounded-sm">
            <ShoppingCart className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 mb-4">Your cart is empty</p>
            <Button onClick={() => navigate("/products")} className="bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#e6c24d] rounded-sm text-sm" data-testid="cart-shop-now">
              BROWSE PRODUCTS
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Table */}
            <div className="lg:col-span-2">
              <div className="border border-white/10 rounded-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 bg-[#242424] hover:bg-[#242424]">
                      <TableHead className="text-white/40 text-[10px] tracking-widest">PRODUCT</TableHead>
                      <TableHead className="text-white/40 text-[10px] tracking-widest text-center">QTY</TableHead>
                      <TableHead className="text-white/40 text-[10px] tracking-widest text-right">PRICE</TableHead>
                      <TableHead className="text-white/40 text-[10px] tracking-widest text-right">TOTAL</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.items.map((item) => (
                      <TableRow key={item.product_id} className="border-white/5 hover:bg-white/[0.02]">
                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <img src={item.image_url} alt="" className="w-12 h-12 object-cover rounded-sm bg-[#333]" />
                            <div>
                              <Link to={`/products/${item.product_id}`} className="text-sm text-white hover:text-[#D4AF37] transition-colors">{item.name}</Link>
                              <p className="text-[10px] font-mono text-white/30">{item.sku}</p>
                              {item.stock_status === "low_stock" && (
                                <Badge className="bg-orange-600/20 text-orange-400 text-[9px] mt-1">
                                  <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> Low stock
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateQty(item.product_id, item.quantity - 1)}
                              disabled={updating[item.product_id]}
                              className="p-1 hover:bg-white/10 rounded transition-colors"
                              data-testid={`cart-qty-decrease-${item.product_id}`}
                            >
                              <Minus className="w-3 h-3 text-white/60" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const v = parseInt(e.target.value);
                                if (v > 0) updateQty(item.product_id, v);
                              }}
                              className="w-12 text-center bg-[#2A2A2A] text-white font-mono text-xs border border-white/10 rounded-sm py-1 focus:outline-none focus:border-[#D4AF37]"
                              data-testid={`cart-qty-input-${item.product_id}`}
                              min="1"
                            />
                            <button
                              onClick={() => updateQty(item.product_id, item.quantity + 1)}
                              disabled={updating[item.product_id]}
                              className="p-1 hover:bg-white/10 rounded transition-colors"
                              data-testid={`cart-qty-increase-${item.product_id}`}
                            >
                              <Plus className="w-3 h-3 text-white/60" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-white/60 py-3">
                          ${item.unit_price?.toFixed(2)}/{item.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-[#D4AF37] font-semibold py-3">
                          ${item.line_total?.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-3">
                          <button
                            onClick={() => removeItem(item.product_id)}
                            disabled={updating[item.product_id]}
                            className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
                            data-testid={`cart-remove-${item.product_id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-between mt-3">
                <Button variant="ghost" onClick={() => navigate("/products")} className="text-xs text-white/40 hover:text-white h-8">
                  Continue Shopping
                </Button>
                <Button variant="ghost" onClick={clearCart} className="text-xs text-red-400/60 hover:text-red-400 h-8" data-testid="clear-cart">
                  Clear Cart
                </Button>
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <div className="bg-[#242424] border border-white/10 rounded-sm p-5 sticky top-24">
                <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: 'Chivo' }}>ORDER SUMMARY</h3>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/50">Items ({cart.item_count})</span>
                    <span className="font-mono text-white">${cart.subtotal?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/50">Shipping</span>
                    <span className="font-mono text-[#4CAF50]">FREE</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between">
                    <span className="text-sm font-semibold text-white">Subtotal</span>
                    <span className="text-lg font-mono font-bold text-[#D4AF37]" data-testid="cart-subtotal">${cart.subtotal?.toFixed(2)}</span>
                  </div>
                </div>

                {belowMin && (
                  <div className="bg-orange-600/10 border border-orange-600/20 rounded-sm px-3 py-2 mb-4" data-testid="minimum-order-warning">
                    <p className="text-xs text-orange-400">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      Minimum order is ${MINIMUM_ORDER.toFixed(2)}. Add ${(MINIMUM_ORDER - cart.subtotal).toFixed(2)} more.
                    </p>
                  </div>
                )}

                <Button
                  onClick={() => navigate("/checkout")}
                  disabled={belowMin}
                  className="w-full bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#e6c24d] rounded-sm font-semibold h-10 disabled:opacity-40"
                  data-testid="proceed-to-checkout"
                >
                  PROCEED TO CHECKOUT <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
