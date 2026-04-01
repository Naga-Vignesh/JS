import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Menu, X, User, LogOut, LayoutDashboard, Package, ClipboardList } from "lucide-react";
import { Button } from "../components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/ui/dropdown-menu";
import { useAuth } from "../contexts/AuthContext";
import SearchBar from "./SearchBar";
import MiniCart from "./MiniCart";

const CATEGORIES = [
  "Meat & Poultry", "Seafood", "Dairy & Eggs", "Fresh Produce",
  "Dry Goods", "Oils & Condiments", "Frozen", "Bakery & Grains"
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 bg-[#1A1A1A] border-b border-white/10" data-testid="navbar">
      {/* Top bar */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0" data-testid="nav-logo">
            <div className="w-8 h-8 bg-[#D4AF37] rounded-sm flex items-center justify-center">
              <span className="text-[#1A1A1A] font-black text-sm" style={{ fontFamily: 'Chivo' }}>S</span>
            </div>
            <div className="hidden sm:block">
              <span className="text-white font-bold text-sm tracking-tight" style={{ fontFamily: 'Chivo' }}>SILVERT</span>
              <span className="text-white/40 text-[10px] block -mt-1 tracking-widest">SUPPLY CO.</span>
            </div>
          </Link>

          {/* Search - center */}
          <SearchBar className="hidden md:block flex-1 max-w-md mx-6" />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <MiniCart />

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-sm transition-colors" data-testid="user-menu-trigger">
                    <div className="w-7 h-7 rounded-full bg-[#D4AF37]/20 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-[#D4AF37]" />
                    </div>
                    <span className="hidden sm:block text-xs text-white/80 max-w-[100px] truncate">{user.name}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-[#2A2A2A] border-white/10 text-white w-48" align="end">
                  <div className="px-3 py-2 border-b border-white/10">
                    <p className="text-xs font-medium truncate">{user.name}</p>
                    <p className="text-[10px] text-white/40 truncate">{user.email}</p>
                    {user.company_name && <p className="text-[10px] text-[#D4AF37] truncate">{user.company_name}</p>}
                  </div>
                  <DropdownMenuItem onClick={() => navigate("/orders")} className="text-xs cursor-pointer hover:bg-white/5" data-testid="nav-orders">
                    <ClipboardList className="w-3.5 h-3.5 mr-2" /> My Orders
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem onClick={() => navigate("/admin")} className="text-xs cursor-pointer hover:bg-white/5" data-testid="nav-admin">
                      <LayoutDashboard className="w-3.5 h-3.5 mr-2" /> Admin Dashboard
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem onClick={handleLogout} className="text-xs text-red-400 cursor-pointer hover:bg-white/5" data-testid="nav-logout">
                    <LogOut className="w-3.5 h-3.5 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-xs text-white/80 hover:text-white hover:bg-white/5 h-8" data-testid="nav-login">
                  Sign In
                </Button>
                <Button size="sm" onClick={() => navigate("/register")} className="text-xs bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#e6c24d] h-8 rounded-sm font-semibold hidden sm:flex" data-testid="nav-register">
                  Get Started
                </Button>
              </div>
            )}

            {/* Mobile menu */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 hover:bg-white/5 rounded-sm" data-testid="mobile-menu-toggle">
              {mobileOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>
      </div>

      {/* Category bar - desktop */}
      <div className="hidden md:block border-t border-white/5 bg-[#1A1A1A]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 h-9 overflow-x-auto">
            <Link
              to="/products"
              className={`px-3 py-1 text-[11px] tracking-wide whitespace-nowrap transition-colors rounded-sm ${
                location.pathname === "/products" && !location.search ? "text-[#D4AF37] bg-[#D4AF37]/10" : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
              data-testid="nav-all-products"
            >
              ALL PRODUCTS
            </Link>
            {CATEGORIES.map((cat) => (
              <Link
                key={cat}
                to={`/products?category=${encodeURIComponent(cat)}`}
                className={`px-3 py-1 text-[11px] tracking-wide whitespace-nowrap transition-colors rounded-sm ${
                  location.search.includes(encodeURIComponent(cat)) ? "text-[#D4AF37] bg-[#D4AF37]/10" : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
                data-testid={`nav-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {cat.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#1A1A1A] border-t border-white/10 px-4 py-4 space-y-3">
          <SearchBar className="w-full" />
          <div className="flex flex-wrap gap-2">
            <Link to="/products" onClick={() => setMobileOpen(false)} className="px-3 py-1.5 text-[11px] text-white/60 bg-white/5 rounded-sm">ALL PRODUCTS</Link>
            {CATEGORIES.map((cat) => (
              <Link key={cat} to={`/products?category=${encodeURIComponent(cat)}`} onClick={() => setMobileOpen(false)}
                className="px-3 py-1.5 text-[11px] text-white/60 bg-white/5 rounded-sm">{cat.toUpperCase()}</Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
