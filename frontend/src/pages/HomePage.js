import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Truck, Shield, Clock, ChevronRight, RefreshCcw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../contexts/AuthContext";
import ProductCard from "../components/ProductCard";
import api from "../lib/api";
import { toast } from "sonner";

const CATEGORIES = [
  { name: "Meat & Poultry", icon: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=300&h=200&fit=crop" },
  { name: "Seafood", icon: "https://images.unsplash.com/photo-1510130113581-14b1a1be0408?w=300&h=200&fit=crop" },
  { name: "Dairy & Eggs", icon: "https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=300&h=200&fit=crop" },
  { name: "Fresh Produce", icon: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=300&h=200&fit=crop" },
  { name: "Dry Goods", icon: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&h=200&fit=crop" },
  { name: "Oils & Condiments", icon: "https://images.unsplash.com/photo-1474979266404-7eabd7a11645?w=300&h=200&fit=crop" },
  { name: "Frozen", icon: "https://images.unsplash.com/photo-1498557850523-fd3d118b962e?w=300&h=200&fit=crop" },
  { name: "Bakery & Grains", icon: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&h=200&fit=crop" },
];

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [featured, setFeatured] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/products/featured");
        setFeatured(data.products || []);
      } catch { /* ignore */ }
      if (user) {
        try {
          const { data } = await api.get("/orders?limit=3");
          setRecentOrders(data.orders || []);
        } catch { /* ignore */ }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const addToCart = async (product) => {
    if (!user) { navigate("/login"); return; }
    try {
      await api.post("/cart/items", { product_id: product.product_id, quantity: 1 });
      window.dispatchEvent(new Event("cart-updated"));
      toast.success(`${product.name} added to cart`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add to cart");
    }
  };

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

  return (
    <div className="bg-[#1A1A1A]" data-testid="home-page">
      {/* Hero */}
      <section className="relative h-[480px] overflow-hidden" data-testid="hero-section">
        <img
          src="https://images.pexels.com/photos/13343442/pexels-photo-13343442.jpeg"
          alt="Kitchen"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative h-full max-w-7xl mx-auto px-4 flex flex-col justify-center">
          <div className="max-w-xl animate-slide-up">
            <Badge className="bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30 mb-4 text-[10px] tracking-widest">
              B2B FOOD DISTRIBUTION
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-none mb-4" style={{ fontFamily: 'Chivo' }}>
              Premium Ingredients.<br />
              <span className="text-gold-gradient">Wholesale Prices.</span>
            </h1>
            <p className="text-base text-white/60 mb-6 max-w-md">
              Trusted by 500+ restaurants. Bulk ordering with volume discounts, real-time inventory, and next-day delivery.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => navigate("/products")} className="bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#e6c24d] rounded-sm font-semibold px-6 h-10" data-testid="hero-shop-now">
                SHOP NOW <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              {!user && (
                <Button variant="outline" onClick={() => navigate("/register")} className="border-white/20 text-white hover:bg-white/10 rounded-sm h-10" data-testid="hero-create-account">
                  CREATE ACCOUNT
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-b border-white/10 bg-[#242424]">
        <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-3 gap-4">
          <div className="flex items-center gap-3 justify-center">
            <Truck className="w-5 h-5 text-[#D4AF37] shrink-0" />
            <span className="text-xs text-white/60">Next-Day Delivery</span>
          </div>
          <div className="flex items-center gap-3 justify-center">
            <Shield className="w-5 h-5 text-[#D4AF37] shrink-0" />
            <span className="text-xs text-white/60">Quality Guaranteed</span>
          </div>
          <div className="flex items-center gap-3 justify-center">
            <Clock className="w-5 h-5 text-[#D4AF37] shrink-0" />
            <span className="text-xs text-white/60">24/7 Ordering</span>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 py-12 space-y-16">
        {/* Quick Reorder Panel */}
        {user && recentOrders.length > 0 && (
          <section data-testid="quick-reorder-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Chivo' }}>QUICK REORDER</h2>
              <Link to="/orders" className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1">
                View all orders <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {recentOrders.map((order) => (
                <div key={order.order_id} className="bg-[#242424] border border-white/10 rounded-sm p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-white/40">{order.order_id}</span>
                    <Badge className="text-[10px] bg-[#2E7D32]/20 text-[#4CAF50]">{order.status}</Badge>
                  </div>
                  <p className="text-sm text-white mb-1">{order.items?.length} items</p>
                  <p className="text-xs font-mono text-[#D4AF37] mb-3">${order.subtotal?.toFixed(2)}</p>
                  <Button
                    size="sm"
                    onClick={() => handleReorder(order.order_id)}
                    className="w-full bg-white/5 text-white hover:bg-white/10 rounded-sm text-xs h-7 border border-white/10"
                    data-testid={`reorder-${order.order_id}`}
                  >
                    <RefreshCcw className="w-3 h-3 mr-1.5" /> Reorder
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        <section data-testid="categories-section">
          <h2 className="text-lg font-bold text-white mb-6" style={{ fontFamily: 'Chivo' }}>SHOP BY CATEGORY</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                to={`/products?category=${encodeURIComponent(cat.name)}`}
                className="group relative aspect-[3/2] overflow-hidden rounded-sm border border-white/10 animate-fade-in"
                data-testid={`category-${cat.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <img src={cat.icon} alt={cat.name} className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h3 className="text-sm font-bold text-white" style={{ fontFamily: 'Chivo' }}>{cat.name}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Featured Products */}
        <section data-testid="featured-section">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'Chivo' }}>FEATURED PRODUCTS</h2>
            <Link to="/products" className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-[#242424] border border-white/10 rounded-sm h-64 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 stagger-children">
              {featured.slice(0, 8).map((p) => (
                <ProductCard key={p.product_id} product={p} onAddToCart={addToCart} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#1A1A1A] mt-16">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#D4AF37] rounded-sm flex items-center justify-center">
                <span className="text-[#1A1A1A] font-black text-[10px]" style={{ fontFamily: 'Chivo' }}>S</span>
              </div>
              <span className="text-white/40 text-xs">SILVERT SUPPLY CO. - B2B Food Distribution</span>
            </div>
            <p className="text-[11px] text-white/30">Trusted by 500+ restaurants nationwide</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
