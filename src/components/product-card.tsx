import { ArrowRight, MessageCircle, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "@/context/cart-context";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  return (
    <article className="product-card group" data-product={product.slug}>
      <Link to={`/produkte/${product.slug}`} className="product-card__image">
        <img src={product.image_urls[0]} alt={product.name} loading="lazy" />
      </Link>
      <div className="product-card__body">
        <p className="product-card__stock">
          {product.catalog_code ? `Kodi ${product.catalog_code} · ` : ""}{product.stock_label}
        </p>
        <Link to={`/produkte/${product.slug}`}><h3>{product.name}</h3></Link>
        <p className="product-card__description">{product.description}</p>
        <p className="product-card__unit">{product.unit}</p>

        <div className="product-card__footer">
          <p>{product.requires_quote ? "Sipas ofertës" : formatCurrency(product.price_cents)}</p>
          {product.requires_quote ? (
            <a
              className="product-card__action"
              href={buildWhatsAppUrl(`Përshëndetje Mr. Clean, dua ofertë për ${product.name}.`)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Kërko ofertë për ${product.name}`}
            >
              <MessageCircle aria-hidden="true" />
            </a>
          ) : (
            <button className="product-card__action" type="button" onClick={() => addItem(product)} aria-label={`Shto ${product.name} në shportë`}>
              <Plus aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <Link to={`/produkte/${product.slug}`} className="product-card__link" aria-label={`Shiko ${product.name}`}>
        <ArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}
