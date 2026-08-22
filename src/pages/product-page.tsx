import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircle, Minus, PackageCheck, Plus, ShieldCheck, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ContextRail, PosterFrame, TrustItem } from "@/components/poster";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useCart } from "@/context/cart-context";
import { getProductBySlug, getProducts } from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

export function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addItem } = useCart();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) return;
      const productsRequest = getProducts();
      try {
        const current = await getProductBySlug(slug);
        const products = await productsRequest.catch(() => []);
        if (!cancelled) {
          setProduct(current);
          setRelated(products
            .filter((item) => item.id !== current?.id && item.category_id === current?.category_id)
            .slice(0, 3));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Produkti nuk u ngarkua.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  const rail = <ContextRail items={[
    { number: "01", label: "Përdorimi", meta: "Profesional" },
    { number: "02", label: "Vëllimi", meta: product?.unit ?? "—" },
    { number: "03", label: "Kategoria", meta: product?.category?.name ?? "Higjienë" },
    { number: "04", label: "Dorëzimi", meta: "Me konfirmim" }
  ]} />;

  if (loading) return <PosterFrame rail={rail}><div className="poster-page"><div className="product-detail-skeleton" /></div></PosterFrame>;

  if (error) {
    return <PosterFrame rail={rail}><div className="poster-page"><EmptyState icon={ShoppingCart} title="Produkti nuk u ngarkua" description={error} /></div></PosterFrame>;
  }

  if (!product) {
    return <PosterFrame rail={rail}><div className="poster-page"><EmptyState icon={ShoppingCart} title="Produkti nuk u gjet" description="Produkti mund të jetë larguar nga katalogu." /></div></PosterFrame>;
  }

  return (
    <PosterFrame rail={rail}>
      <div className="product-page poster-page">
        <Link to="/produkte" className="back-link"><ArrowLeft aria-hidden="true" />Kthehu te katalogu</Link>

        <div className="product-detail">
          <div className="product-detail__visual" data-product={product.slug}>
            <h1>{product.name}</h1>
            <img src={product.image_urls[0]} alt={product.name} loading="eager" fetchPriority="high" />
          </div>

          <div className="product-detail__buy">
            <span className="locator-bar" aria-hidden="true" />
            <p className="stock-line">
              <CheckCircle2 aria-hidden="true" />
              {product.catalog_code ? `Kodi ${product.catalog_code} · ` : ""}{product.stock_label}
            </p>
            <p className="product-detail__description">{product.description}</p>
            <div className="price-block">
              <span>Çmimi</span>
              <strong>{product.requires_quote ? "Sipas ofertës" : formatCurrency(product.price_cents)}</strong>
              <small>/ {product.unit}</small>
            </div>

            {product.requires_quote ? (
              <a className="poster-cta w-full" href={buildWhatsAppUrl(`Përshëndetje Mr. Clean, dua ofertë për ${product.name}.`)} target="_blank" rel="noreferrer">
                Kontakto për ofertë <MessageCircle aria-hidden="true" />
              </a>
            ) : (
              <>
                <div className="quantity-picker">
                  <button type="button" aria-label="Ule sasinë" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Minus aria-hidden="true" /></button>
                  <span>{quantity}</span>
                  <button type="button" aria-label="Rrit sasinë" onClick={() => setQuantity((value) => value + 1)}><Plus aria-hidden="true" /></button>
                </div>
                <button className="poster-cta w-full" type="button" onClick={() => addItem(product, quantity)}>
                  Shto në shportë <ArrowRight aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="product-assurances">
          <TrustItem icon={ShieldCheck} title="Në stok" text="Gati për dërgesë të menjëhershme." />
          <TrustItem icon={PackageCheck} title="Çmimi në EUR" text="Transparencë dhe kursim për biznesin tuaj." />
          <TrustItem icon={MessageCircle} title="Porosi e konfirmuar në WhatsApp" text="Mbështetje e drejtpërdrejtë." />
        </div>

        {related.length > 0 ? (
          <section className="related-products">
            <h2><span className="locator-bar" aria-hidden="true" />Produkte të ngjashme</h2>
            <div className="product-grid product-grid--related">{related.map((item) => <ProductCard key={item.id} product={item} />)}</div>
          </section>
        ) : null}
      </div>
    </PosterFrame>
  );
}
