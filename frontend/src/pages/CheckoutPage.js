import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarIcon, CheckCircle2, ArrowLeft, Package } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Badge } from "../components/ui/badge";
import { format, addDays } from "date-fns";
import api from "../lib/api";
import { toast } from "sonner";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState(null);
  const [deliveryDate, setDeliveryDate] = useState(addDays(new Date(), 1));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(null);

  const fetchCart = useCallback(async () => {
    try {
      const { data } = await api.get("/cart");
      setCart(data);
      if (!data.items?.length) navigate("/cart");
    } catch { navigate("/cart"); }
    setLoading(false);
  }, [navigate]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const handleSubmit = async () => {
    if (!deliveryDate) { toast.error("Please select a delivery date"); return; }
    setSubmitting(true);
    try {
      const { data } = await api.post("/orders", {
        delivery_date: format(deliveryDate, "yyyy-MM-dd"),
        notes
      });
      setOrderComplete(data.order);
      window.dispatchEvent(new Event("cart-updated"));
      toast.success("Order placed successfully!");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to place order");
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Order confirmation
  if (orderComplete) return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center px-4" data-testid="order-confirmation">
      <div className="max-w-md w-full text-center animate-slide-up">
        <CheckCircle2 className="w-16 h-16 text-[#4CAF50] mx-auto mb-4" />
        <h1 className="text-2xl font-black text-white mb-2" style={{ fontFamily: 'Chivo' }}>Order Confirmed!</h1>
        <p className="text-sm text-white/50 mb-6">Your order has been placed and is being processed.</p>
        <div className="bg-[#242424] border border-white/10 rounded-sm p-4 mb-6 text-left">
          <div className="flex justify-between mb-2">
            <span className="text-xs text-white/40">Order ID</span>
            <span className="text-xs font-mono text-[#D4AF37]" data-testid="order-id">{orderComplete.order_id}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-xs text-white/40">Items</span>
            <span className="text-xs text-white">{orderComplete.items?.length}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-xs text-white/40">Delivery</span>
            <span className="text-xs text-white">{orderComplete.delivery_date}</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
            <span className="text-sm font-semibold text-white">Total</span>
            <span className="text-sm font-mono font-bold text-[#D4AF37]">${orderComplete.subtotal?.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => navigate("/orders")} className="flex-1 bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#e6c24d] rounded-sm font-semibold h-10" data-testid="view-orders-btn">
            VIEW ORDERS
          </Button>
          <Button onClick={() => navigate("/products")} variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/5 rounded-sm h-10" data-testid="continue-shopping-btn">
            CONTINUE SHOPPING
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-[#1A1A1A] min-h-screen" data-testid="checkout-page">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate("/cart")} className="text-white/40 hover:text-white text-xs mb-6 -ml-2 h-8" data-testid="back-to-cart">
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to cart
        </Button>

        <h1 className="text-2xl font-black text-white mb-6" style={{ fontFamily: 'Chivo' }}>Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Review */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#242424] border border-white/10 rounded-sm p-5">
              <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: 'Chivo' }}>
                <Package className="w-4 h-4 inline mr-2 text-[#D4AF37]" /> ORDER REVIEW
              </h3>
              <div className="space-y-3">
                {cart?.items?.map((item) => (
                  <div key={item.product_id} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <img src={item.image_url} alt="" className="w-10 h-10 object-cover rounded-sm bg-[#333]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.name}</p>
                      <p className="text-[10px] font-mono text-white/30">{item.sku} - Qty: {item.quantity}</p>
                    </div>
                    <span className="font-mono text-sm text-[#D4AF37]">${item.line_total?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Delivery Date */}
            <div className="bg-[#242424] border border-white/10 rounded-sm p-5">
              <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: 'Chivo' }}>
                <CalendarIcon className="w-4 h-4 inline mr-2 text-[#D4AF37]" /> DELIVERY DATE
              </h3>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left bg-[#2A2A2A] border-white/10 text-white hover:bg-white/5 h-10"
                    data-testid="delivery-date-trigger"
                  >
                    <CalendarIcon className="w-4 h-4 mr-2 text-[#D4AF37]" />
                    {deliveryDate ? format(deliveryDate, "EEEE, MMMM do, yyyy") : "Select delivery date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-[#2A2A2A] border-white/10" align="start">
                  <Calendar
                    mode="single"
                    selected={deliveryDate}
                    onSelect={setDeliveryDate}
                    disabled={(date) => date < addDays(new Date(), 1)}
                    data-testid="delivery-calendar"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Notes */}
            <div className="bg-[#242424] border border-white/10 rounded-sm p-5">
              <h3 className="text-sm font-semibold text-white mb-3" style={{ fontFamily: 'Chivo' }}>ORDER NOTES</h3>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special instructions, delivery notes..."
                className="bg-[#2A2A2A] border-white/10 text-white text-sm min-h-[80px] placeholder:text-white/30"
                data-testid="order-notes"
              />
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="bg-[#242424] border border-white/10 rounded-sm p-5 sticky top-24">
              <h3 className="text-sm font-semibold text-white mb-4" style={{ fontFamily: 'Chivo' }}>SUMMARY</h3>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Items ({cart?.item_count})</span>
                  <span className="font-mono text-white">${cart?.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Shipping</span>
                  <span className="font-mono text-[#4CAF50]">FREE</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Delivery</span>
                  <span className="text-xs text-white">{deliveryDate ? format(deliveryDate, "MMM d") : "—"}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between">
                  <span className="text-sm font-semibold text-white">Total</span>
                  <span className="text-lg font-mono font-bold text-[#D4AF37]">${cart?.subtotal?.toFixed(2)}</span>
                </div>
              </div>

              <Badge className="w-full justify-center bg-white/5 text-white/40 border-white/10 text-[10px] mb-4 py-1">
                MOCK CHECKOUT - No real payment
              </Badge>

              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#e6c24d] rounded-sm font-semibold h-10 animate-pulse-gold"
                data-testid="place-order-button"
              >
                {submitting ? "Placing order..." : "CONFIRM ORDER"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
