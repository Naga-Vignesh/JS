import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Grid3X3, List, SlidersHorizontal, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import ProductCard from "../components/ProductCard";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { toast } from "sonner";

const CATEGORIES = [
  "Meat & Poultry", "Seafood", "Dairy & Eggs", "Fresh Produce",
  "Dry Goods", "Oils & Condiments", "Frozen", "Bakery & Grains"
];

export default function ProductsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const category = searchParams.get("category") || "";
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "name";
  const page = parseInt(searchParams.get("page") || "1");
  const availability = searchParams.get("availability") || "";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category) params.set("category", category);
        if (search) params.set("search", search);
        if (sort) params.set("sort", sort);
        if (availability) params.set("availability", availability);
        params.set("page", page.toString());
        params.set("limit", "20");
        const { data } = await api.get(`/products?${params}`);
        setProducts(data.products || []);
        setTotal(data.total || 0);
        setPages(data.pages || 1);
      } } catch (err) {
          console.error("Failed to load products:", err?.response?.data || err.message || err);
        }
      setLoading(false);
    };
    load();
  }, [category, search, sort, page, availability]);

  const updateParam = (key, val) => {
    const params = new URLSearchParams(searchParams);
    if (val) params.set(key, val); else params.delete(key);
    if (key !== "page") params.set("page", "1");
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const addToCart = async (product) => {
    if (!user) { navigate("/login"); return; }
    try {
      await api.post("/cart/items", { product_id: product.product_id, quantity: 1 });
      window.dispatchEvent(new Event("cart-updated"));
      toast.success(`${product.name} added to cart`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add");
    }
  };

  const hasFilters = category || search || availability;

  return (
    <div className="bg-[#1A1A1A] min-h-screen" data-testid="products-page">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-white" style={{ fontFamily: 'Chivo' }}>
              {category || "All Products"}
            </h1>
            <p className="text-xs text-white/40 mt-1">{total} products found</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="md:hidden border-white/10 text-white/60 h-8 text-xs" data-testid="toggle-filters">
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" /> Filters
            </Button>
            <Select value={sort} onValueChange={(v) => updateParam("sort", v)}>
              <SelectTrigger className="w-[140px] bg-[#2A2A2A] border-white/10 text-white text-xs h-8" data-testid="sort-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#2A2A2A] border-white/10">
                <SelectItem value="name" className="text-white text-xs">Name A-Z</SelectItem>
                <SelectItem value="price_low" className="text-white text-xs">Price: Low</SelectItem>
                <SelectItem value="price_high" className="text-white text-xs">Price: High</SelectItem>
                <SelectItem value="newest" className="text-white text-xs">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar filters */}
          <aside className={`${showFilters ? "block" : "hidden"} md:block w-48 shrink-0`}>
            <div className="sticky top-24 space-y-6">
              {/* Categories */}
              <div>
                <h3 className="text-xs font-semibold text-white/60 mb-2 tracking-widest">CATEGORY</h3>
                <div className="space-y-1">
                  <button
                    onClick={() => updateParam("category", "")}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded-sm transition-colors ${!category ? "text-[#D4AF37] bg-[#D4AF37]/10" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                    data-testid="filter-all-categories"
                  >
                    All Categories
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => updateParam("category", cat)}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded-sm transition-colors ${category === cat ? "text-[#D4AF37] bg-[#D4AF37]/10" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                      data-testid={`filter-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Availability */}
              <div>
                <h3 className="text-xs font-semibold text-white/60 mb-2 tracking-widest">AVAILABILITY</h3>
                <div className="space-y-1">
                  {[["", "All"], ["in_stock", "In Stock"], ["out_of_stock", "Out of Stock"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => updateParam("availability", val)}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded-sm transition-colors ${availability === val ? "text-[#D4AF37] bg-[#D4AF37]/10" : "text-white/50 hover:text-white hover:bg-white/5"}`}
                      data-testid={`filter-availability-${val || "all"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search within */}
              <div>
                <h3 className="text-xs font-semibold text-white/60 mb-2 tracking-widest">SEARCH</h3>
                <Input
                  value={search}
                  onChange={(e) => updateParam("search", e.target.value)}
                  placeholder="Filter..."
                  className="bg-[#2A2A2A] border-white/10 text-white text-xs h-8"
                  data-testid="filter-search-input"
                />
              </div>

              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-white/40 hover:text-white w-full h-7" data-testid="clear-filters">
                  <X className="w-3 h-3 mr-1" /> Clear Filters
                </Button>
              )}
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {/* Active filters */}
            {hasFilters && (
              <div className="flex flex-wrap gap-2 mb-4">
                {category && (
                  <Badge className="bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20 text-[10px] cursor-pointer" onClick={() => updateParam("category", "")}>
                    {category} <X className="w-3 h-3 ml-1" />
                  </Badge>
                )}
                {search && (
                  <Badge className="bg-white/5 text-white/60 border-white/10 text-[10px] cursor-pointer" onClick={() => updateParam("search", "")}>
                    Search: {search} <X className="w-3 h-3 ml-1" />
                  </Badge>
                )}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-[#242424] border border-white/10 rounded-sm h-64 animate-pulse" />
                ))}
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 stagger-children">
                  {products.map((p) => (
                    <ProductCard key={p.product_id} product={p} onAddToCart={addToCart} />
                  ))}
                </div>

                {/* Pagination */}
                {pages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "ghost"}
                        size="sm"
                        onClick={() => updateParam("page", p.toString())}
                        className={`w-8 h-8 text-xs ${p === page ? "bg-[#D4AF37] text-[#1A1A1A]" : "text-white/40 hover:text-white"}`}
                        data-testid={`page-${p}`}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <p className="text-white/40 text-sm mb-2">No products found</p>
                <p className="text-white/20 text-xs">Try adjusting your filters or search terms</p>
                <Button variant="ghost" onClick={clearFilters} className="text-[#D4AF37] text-xs mt-4" data-testid="no-results-clear">
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
