import { useNavigate } from "react-router-dom";
import { ShoppingCart, AlertTriangle } from "lucide-react";
import { Badge } from "../components/ui/badge";

export default function ProductCard({ product, onAddToCart }) {
  const navigate = useNavigate();
  const stockStatus = product.stock_status || "in_stock";
  const isLow = stockStatus === "low_stock";
  const isOut = stockStatus === "out_of_stock";
  const displayPrice = product.custom_price || product.base_price;
  const hasDiscount = product.pricing_tiers?.length > 1;

  return (
    <div
      className="group border border-white/10 bg-[#242424] rounded-sm overflow-hidden transition-all duration-150 hover:border-[#D4AF37]/30 animate-fade-in cursor-pointer"
      data-testid={`product-card-${product.product_id}`}
      onClick={() => navigate(`/products/${product.product_id}`)}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#1A1A1A]">
        <img
          src={product.image_url}
          alt={product.name}
          className="w-full h-full object-cover product-image-hover"
          loading="lazy"
          onError={(e) => { e.target.src = "https://images.unsplash.com/photo-1495195134817-aeb325a55b65?w=400"; }}
        />
        {isOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Badge variant="destructive" className="text-xs">OUT OF STOCK</Badge>
          </div>
        )}
        {isLow && !isOut && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-orange-600/90 text-white text-[10px] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Only {product.stock_quantity} left
            </Badge>
          </div>
        )}
        {hasDiscount && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-[#D4AF37] text-[#1A1A1A] text-[10px] font-semibold">BULK PRICING</Badge>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-[10px] font-mono text-white/40 mb-1">{product.sku}</p>
        <h3 className="text-sm font-medium text-white leading-tight mb-1 line-clamp-2">{product.name}</h3>
        <p className="text-[11px] text-white/40 mb-2">{product.category}</p>
        <div className="flex items-end justify-between">
          <div>
            <span className="text-lg font-mono font-semibold text-[#D4AF37]">${displayPrice?.toFixed(2)}</span>
            <span className="text-[10px] text-white/40 ml-1">/{product.unit}</span>
          </div>
          {!isOut && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToCart?.(product); }}
              className="p-1.5 bg-[#D4AF37] hover:bg-[#e6c24d] rounded-sm transition-colors"
              data-testid={`add-to-cart-${product.product_id}`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-[#1A1A1A]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
