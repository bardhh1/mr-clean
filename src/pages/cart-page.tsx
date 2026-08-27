import { ArrowRight, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { PageIntro, PosterFrame } from "@/components/poster";
import { EmptyState } from "@/components/ui/empty-state";
import { useCart } from "@/context/cart-context";
import { formatCurrency } from "@/lib/format";

export function CartPage() {
  const { items, count, subtotal, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <PosterFrame>
        <div className="poster-page min-h-dvh">
          <PageIntro title="Shporta" />
          <EmptyState icon={ShoppingCart} title="Shporta është bosh" description="Shfleto katalogun dhe shto produktet që i duhen biznesit tënd." action={<Link className="poster-cta" to="/produkte">Shiko produktet<ArrowRight aria-hidden="true" /></Link>} />
        </div>
      </PosterFrame>
    );
  }

  return (
    <PosterFrame>
      <div className="cart-page poster-page">
        <PageIntro title="Shporta" aside={<p className="page-count">{count} artikuj</p>} />

        <div className="cart-layout">
          <div className="cart-list">
            {items.map((item) => (
              <article key={item.product.id} className="cart-row">
                <Link to={`/produkte/${item.product.slug}`} className="cart-row__image"><img src={item.product.image_urls[0]} alt={item.product.name} /></Link>
                <div className="cart-row__name">
                  <Link to={`/produkte/${item.product.slug}`}>{item.product.name}</Link>
                  <span>{item.product.unit}</span>
                </div>
                <strong>{formatCurrency(item.product.price_cents * item.quantity)}</strong>
                <div className="quantity-picker quantity-picker--small">
                  <button type="button" aria-label="Ule sasinë" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}><Minus aria-hidden="true" /></button>
                  <span>{item.quantity}</span>
                  <button type="button" aria-label="Rrit sasinë" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}><Plus aria-hidden="true" /></button>
                </div>
                <button className="remove-item" type="button" aria-label={`Largo ${item.product.name}`} onClick={() => removeItem(item.product.id)}><Trash2 aria-hidden="true" /><span>Hiq</span></button>
              </article>
            ))}
            <Link to="/produkte" className="add-more"><Plus aria-hidden="true" />Shto produkte të tjera</Link>
          </div>

          <aside className="order-summary">
            <p><span>Nëntotali</span><strong>{formatCurrency(subtotal)}</strong></p>
            <p className="order-summary__total"><span>Totali</span><strong>{formatCurrency(subtotal)}</strong></p>
            <span className="locator-bar" aria-hidden="true" />
            <small>Stoku, transporti dhe totali final konfirmohen nga ekipi ynë.</small>
            <Link to="/checkout" className="poster-cta poster-cta--light">Vazhdo te porosia<ArrowRight aria-hidden="true" /></Link>
          </aside>
        </div>
      </div>
    </PosterFrame>
  );
}
