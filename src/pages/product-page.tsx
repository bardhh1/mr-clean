import {
  ArrowLeft,
  CheckCircle2,
  MessageCircle,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingBag
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useCart } from "@/context/cart-context";
import { getProductBySlug, getProducts } from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";

const assurances = [
  { icon: PackageCheck, text: "Porosi e konfirmuar direkt nga ekipi ynë" },
  { icon: ShieldCheck, text: "Pagesë cash ose me transfer bankar" },
  { icon: CheckCircle2, text: "Furnizim për përdorim profesional" }
];

export function ProductPage() {
  const { slug } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) return;
      const current = await getProductBySlug(slug);
      const products = await getProducts();
      if (!cancelled) {
        setProduct(current);
        setRelated(
          products
            .filter((item) => item.category_id === current?.category_id && item.id !== current.id)
            .slice(0, 4)
        );
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="page-shell">
        <div className="surface h-[560px] animate-pulse bg-muted" />
      </div>
    );
  }

  if (!product) {
    return (
      <section className="page-shell">
        <EmptyState
          icon={ShoppingBag}
          title="Produkti nuk u gjet"
          description="Produkti mund të jetë larguar nga katalogu."
          action={<Button asChild><Link to="/produkte">Kthehu te produktet</Link></Button>}
        />
      </section>
    );
  }

  return (
    <section>
      <div className="border-b bg-white">
        <div className="container py-4">
          <Link
            to="/produkte"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kthehu te katalogu
          </Link>
        </div>
      </div>

      <div className="page-shell">
        <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <div className="overflow-hidden rounded-lg border bg-muted">
            <img
              src={product.image_urls[0]}
              alt={product.name}
              width={1000}
              height={800}
              className="aspect-[4/3] h-full w-full object-cover"
            />
          </div>

          <div className="lg:sticky lg:top-36 lg:self-start">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-primary">
              <span className="h-2 w-2 rounded-full bg-accent" />
              {product.stock_label}
            </div>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.04] md:text-6xl">{product.name}</h1>
            <p className="mt-5 text-base leading-8 text-muted-foreground md:text-lg">
              {product.description}
            </p>

            <div className="mt-8 border-y py-6">
              <p className="text-xs font-bold uppercase text-muted-foreground">Çmimi</p>
              <div className="mt-2 flex items-end gap-3">
                <p className="price-figure text-4xl">
                  {product.requires_quote ? "Sipas ofertës" : formatCurrency(product.price_cents)}
                </p>
                <p className="pb-1 text-sm font-medium text-muted-foreground">/ {product.unit}</p>
              </div>
            </div>

            {product.requires_quote ? (
              <Button asChild size="lg" className="mt-6 w-full sm:w-auto">
                <Link to="/oferta/peceta">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  Kërko ofertë të personalizuar
                </Link>
              </Button>
            ) : (
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <div className="flex h-12 w-full items-center justify-between rounded-md border bg-white sm:w-36">
                  <button
                    type="button"
                    aria-label="Ule sasinë"
                    className="flex h-12 w-12 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="font-bold tabular-nums">{quantity}</span>
                  <button
                    type="button"
                    aria-label="Rrit sasinë"
                    className="flex h-12 w-12 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => setQuantity((value) => value + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Button size="lg" className="w-full sm:flex-1" onClick={() => addItem(product, quantity)}>
                  <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                  Shto në shportë
                </Button>
              </div>
            )}

            <div className="mt-8 border-t">
              {assurances.map((item) => (
                <div key={item.text} className="flex items-center gap-3 border-b py-4 text-sm text-muted-foreground">
                  <item.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <div className="mt-20 border-t pt-12">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="hairline-label">Nga e njëjta kategori</p>
                <h2 className="mt-4 text-3xl font-extrabold">Produkte të ngjashme</h2>
              </div>
              <Button asChild variant="outline" className="hidden sm:inline-flex">
                <Link to="/produkte">Katalogu</Link>
              </Button>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
