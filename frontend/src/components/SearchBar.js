import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Input } from "../components/ui/input";
import api from "../lib/api";

export default function SearchBar({ className = "" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/search?q=${encodeURIComponent(query)}&limit=6`);
        setResults(data.results || []);
        setOpen(true);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const goToProduct = (id) => {
    setOpen(false);
    setQuery("");
    navigate(`/products/${id}`);
  };

  const goToSearch = () => {
    setOpen(false);
    navigate(`/products?search=${encodeURIComponent(query)}`);
    setQuery("");
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`} data-testid="search-bar">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <Input
          data-testid="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && goToSearch()}
          placeholder="Search products, SKUs..."
          className="pl-10 pr-8 bg-[#2A2A2A] border-white/10 text-white placeholder:text-white/40 focus:ring-[#D4AF37] focus:border-[#D4AF37] h-9"
        />
        {query && (
          <button onClick={() => { setQuery(""); setOpen(false); }} className="absolute right-3 top-1/2 -translate-y-1/2" data-testid="search-clear">
            <X className="w-3.5 h-3.5 text-white/40 hover:text-white" />
          </button>
        )}
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#2A2A2A] border border-white/10 rounded-sm shadow-xl z-50 max-h-80 overflow-y-auto" data-testid="search-results-dropdown">
          {loading ? (
            <div className="p-4 text-center text-white/40 text-sm">Searching...</div>
          ) : results.length > 0 ? (
            <>
              {results.map((p) => (
                <button
                  key={p.product_id}
                  onClick={() => goToProduct(p.product_id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
                  data-testid={`search-result-${p.product_id}`}
                >
                  <img src={p.image_url} alt="" className="w-10 h-10 object-cover rounded-sm bg-[#333]" loading="lazy" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{p.name}</p>
                    <p className="text-xs text-white/40 font-mono">{p.sku}</p>
                  </div>
                  <span className="text-sm font-mono text-[#D4AF37]">${p.base_price?.toFixed(2)}</span>
                </button>
              ))}
              <button onClick={goToSearch} className="w-full px-4 py-2 text-xs text-[#D4AF37] hover:bg-white/5 border-t border-white/10" data-testid="search-view-all">
                View all results for "{query}"
              </button>
            </>
          ) : (
            <div className="p-4 text-center text-white/40 text-sm">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
