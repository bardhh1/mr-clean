import { ArrowUpRight, MessageCircle, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/cart-context";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const image = product.image_urls[0];

  return (
    <article className="group flex min-h-full flex-col overflow-hidden rounded-lg border bg-white transition-[border-color,box-shadow] duration-200 hover:border-primary/45 hover:shadow-lift">
      <Link to={`/produkte/${product.slug}`} className="relative block overflow-hidden bg-muted">
        <div className="aspect-[4/3] overflow-hidden">
          <img
            src={image}
            alt={product.name}
            width={640}
            height={480}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
            loading="lazy"
          />
        </div>
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <span className="rounded-md border border-white/40 bg-white/[0.92] px-2.5 py-1 text-xs font-bold text-foreground shadow-sm backdrop-blur-sm">
            {product.stock_label}
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white/[0.92] text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 md:p-5">
        <Link to={`/produkte/${product.slug}`}>
          <h3 className="line-clamp-2 text-base font-bold leading-6 text-foreground transition-colors hover:text-primary">
            {product.name}
          </h3>
        </Link>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
          {product.description}
        </p>

        <div className="mt-5 flex items-end justify-between gap-3 border-t pt-4">
          <div className="min-w-0">
            <p className="price-figure text-xl">
              {product.requires_quote ? "Sipas ofertës" : formatCurrency(product.price_cents)}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">{product.unit}</p>
          </div>
          {product.requires_quote ? (
            <Button asChild size="icon" variant="secondary" aria-label="Kërko ofertë">
              <Link to="/oferta/peceta">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              aria-label={`Shto ${product.name} në shportë`}
              onClick={() => addItem(product)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
