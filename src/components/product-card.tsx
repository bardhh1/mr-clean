import { MessageCircle, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/cart-context";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const image = product.image_urls[0];

  return (
    <article className="group overflow-hidden rounded-lg border bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift">
      <Link to={`/produkte/${product.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
          <div className="absolute left-3 top-3">
            <Badge variant={product.requires_quote ? "secondary" : "outline"} className="bg-white/90 backdrop-blur">
              {product.stock_label}
            </Badge>
          </div>
        </div>
      </Link>
      <div className="flex min-h-[238px] flex-col p-4">
        <div>
          <Link to={`/produkte/${product.slug}`}>
            <h3 className="line-clamp-2 text-base font-black leading-6 text-slate-950 transition-colors hover:text-primary">
              {product.name}
            </h3>
          </Link>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{product.description}</p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 border-t pt-4">
          <div>
            <p className="text-xl font-black text-slate-950">
              {product.requires_quote ? "Me ofertë" : formatCurrency(product.price_cents)}
            </p>
            <p className="text-xs font-semibold text-slate-500">{product.unit}</p>
          </div>
          {product.requires_quote ? (
            <Button asChild size="sm" variant="secondary">
              <Link to="/oferta/peceta">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Ofertë
              </Link>
            </Button>
          ) : (
            <Button type="button" size="sm" onClick={() => addItem(product)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Shto
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
