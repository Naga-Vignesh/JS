import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCcw, ChevronDown, ChevronUp, Package, Eye } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import api from "../lib/api";
import { toast } from "sonner";

const STATUS_COLORS = {
  pending: "bg-yellow-600/20 text-yellow-400",
  confirmed: "bg-blue-600/20 text-blue-400",
  processing: "bg-purple-600/20 text-purple-400",
  shipped: "bg-cyan-600/20 text-cyan-400",
  delivered: "bg-[#2E7D32]/20 text-[#4CAF50]",
  cancelled: "bg-red-600/20 text-red-400",
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/orders?limit=50");
        setOrders(data.orders || []);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const handleReorder = async (orderId) => {
    try {
      await api.post(`/orders/${orderId}/reorder`);
      window.dispatchEvent(new Event("cart-updated"));
      toast.success("Items added to cart");
      navigate("/cart");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to reorder");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="bg-[#1A1A1A] min-h-screen" data-testid="orders-page">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-black text-white mb-6" style={{ fontFamily: 'Chivo' }}>
          <Package className="w-6 h-6 inline mr-2 text-[#D4AF37]" /> My Orders
        </h1>

        {!orders.length ? (
          <div className="text-center py-16 bg-[#242424] border border-white/10 rounded-sm">
            <Package className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/40 mb-4">No orders yet</p>
            <Button onClick={() => navigate("/products")} className="bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#e6c24d] rounded-sm text-sm" data-testid="orders-shop-now">
              START SHOPPING
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const expanded = expandedId === order.order_id;
              return (
                <div key={order.order_id} className="bg-[#242424] border border-white/10 rounded-sm overflow-hidden" data-testid={`order-${order.order_id}`}>
                  <button
                    onClick={() => setExpandedId(expanded ? null : order.order_id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
                    data-testid={`order-toggle-${order.order_id}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div>
                        <p className="text-xs font-mono text-white/40">{order.order_id}</p>
                        <p className="text-sm text-white">{order.items?.length} items</p>
                      </div>
                      <Badge className={`${STATUS_COLORS[order.status] || "bg-white/10 text-white/40"} text-[10px]`}>
                        {order.status?.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-mono text-sm font-semibold text-[#D4AF37]">${order.subtotal?.toFixed(2)}</p>
                        <p className="text-[10px] text-white/30">{order.created_at?.slice(0, 10)}</p>
                      </div>
                      {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-white/10 px-5 py-4 animate-fade-in">
                      <div className="space-y-2 mb-4">
                        {order.items?.map((item, i) => (
                          <div key={i} className="flex items-center gap-3 py-1.5">
                            <img src={item.image_url} alt="" className="w-8 h-8 object-cover rounded-sm bg-[#333]" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white truncate">{item.name}</p>
                              <p className="text-[10px] font-mono text-white/30">{item.sku} x {item.quantity} @ ${item.unit_price?.toFixed(2)}</p>
                            </div>
                            <span className="font-mono text-xs text-white/60">${item.line_total?.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/30 mb-4">
                        {order.delivery_date && <span>Delivery: {order.delivery_date}</span>}
                        {order.notes && <span>Notes: {order.notes}</span>}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleReorder(order.order_id)}
                        className="bg-white/5 text-white hover:bg-white/10 rounded-sm text-xs h-8 border border-white/10"
                        data-testid={`reorder-btn-${order.order_id}`}
                      >
                        <RefreshCcw className="w-3 h-3 mr-1.5" /> Reorder
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
