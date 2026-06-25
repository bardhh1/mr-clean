import { ArrowLeft, MessageCircle, Minus, Plus, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useCart } from "@/context/cart-context";
import { getProductBySlug, getProducts } from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/lib/types";

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
            .slice(0, 3)
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
    return <div className="container py-10"><div className="surface h-96 animate-pulse bg-muted" /></div>;
  }

  if (!product) {
    return (
      <section className="container py-10">
        <EmptyState
          icon={ShoppingCart}
          title="Produkti nuk u gjet"
          description="Produkti mund të jetë larguar nga katalogu."
          action={<Button asChild><Link to="/produkte">Kthehu te produktet</Link></Button>}
        />
      </section>
    );
  }

  return (
    <section className="container py-10">
      <Button asChild variant="ghost" className="mb-5">
        <Link to="/produkte">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Produktet
        </Link>
      </Button>
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
        <div className="overflow-hidden rounded-lg border bg-muted">
          <img
            src={product.image_urls[0]}
            alt={product.name}
            className="aspect-[4/3] h-full w-full object-cover"
          />
        </div>
        <div>
          <Badge variant={product.requires_quote ? "secondary" : "outline"}>
            {product.stock_label}
          </Badge>
          <h1 className="mt-4 text-3xl font-bold md:text-5xl">{product.name}</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">{product.description}</p>
          <div className="mt-6 rounded-lg border bg-card p-5">
            <p className="text-sm text-muted-foreground">Çmimi</p>
            <p className="mt-1 text-3xl font-bold">
              {product.requires_quote ? "Me ofertë" : formatCurrency(product.price_cents)}
            </p>
            <p className="text-sm text-muted-foreground">{product.unit}</p>
          </div>

          {product.requires_quote ? (
            <Button asChild size="lg" className="mt-6 w-full sm:w-auto">
              <Link to="/oferta/peceta">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                Kërko ofertë
              </Link>
            </Button>
          ) : (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <div className="flex h-12 w-full items-center justify-between rounded-md border bg-card sm:w-36">
                <button
                  type="button"
                  aria-label="Ule sasinë"
                  className="flex h-12 w-12 items-center justify-center"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-semibold">{quantity}</span>
                <button
                  type="button"
                  aria-label="Rrit sasinë"
                  className="flex h-12 w-12 items-center justify-center"
                  onClick={() => setQuantity((value) => value + 1)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <Button size="lg" className="w-full sm:w-auto" onClick={() => addItem(product, quantity)}>
                <ShoppingCart className="h-5 w-5" aria-hidden="true" />
                Shto në shportë
              </Button>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 ? (
        <div className="mt-12">
          <h2 className="text-2xl font-bold">Produkte të ngjashme</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {related.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <Link to={`/produkte/${item.slug}`} className="font-semibold hover:text-primary">
                    {item.name}
                  </Link>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.requires_quote ? "Me ofertë" : formatCurrency(item.price_cents)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
