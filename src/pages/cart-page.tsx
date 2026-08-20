import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useCart } from "@/context/cart-context";
import { formatCurrency } from "@/lib/format";

export function CartPage() {
  const { items, count, subtotal, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <section className="page-shell min-h-[64dvh]">
        <EmptyState
          icon={ShoppingBag}
          title="Shporta është bosh"
          description="Shto produkte standarde në shportë ose kërko ofertë për peceta të personalizuara."
          action={<Button asChild><Link to="/produkte">Shiko produktet</Link></Button>}
        />
      </section>
    );
  }

  return (
    <section className="min-h-[70dvh]">
      <div className="border-b bg-white">
        <div className="container py-10 md:py-14">
          <p className="hairline-label">Porosia juaj</p>
          <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <h1 className="text-4xl font-extrabold md:text-6xl">Shporta</h1>
            <p className="text-sm font-medium tabular-nums text-muted-foreground">{count} artikuj gjithsej</p>
          </div>
        </div>
      </div>

      <div className="page-shell grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="border-t bg-white">
          {items.map((item) => (
            <article
              key={item.product.id}
              className="grid gap-5 border-b py-6 sm:grid-cols-[128px_1fr_auto] sm:items-center"
            >
              <Link to={`/produkte/${item.product.slug}`} className="block w-32 overflow-hidden rounded-md bg-muted">
                <img
                  src={item.product.image_urls[0]}
                  alt={item.product.name}
                  width={256}
                  height={256}
                  className="aspect-square w-full object-cover"
                />
              </Link>
              <div>
                <Link to={`/produkte/${item.product.slug}`}>
                  <h2 className="text-lg font-bold hover:text-primary">{item.product.name}</h2>
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">{item.product.unit}</p>
                <p className="price-figure mt-3 text-lg">{formatCurrency(item.product.price_cents)}</p>
              </div>
              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <div className="flex items-center rounded-md border bg-white">
                  <button
                    type="button"
                    aria-label="Ule sasinë"
                    className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-9 text-center font-bold tabular-nums">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="Rrit sasinë"
                    className="flex h-11 w-11 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Largo ${item.product.name}`}
                  onClick={() => removeItem(item.product.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </article>
          ))}
          <Button asChild variant="ghost" className="mt-4 px-0 hover:bg-transparent hover:text-primary">
            <Link to="/produkte">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Shto produkte të tjera
            </Link>
          </Button>
        </div>

        <aside className="brand-ink rounded-lg p-6 lg:sticky lg:top-36">
          <p className="text-xs font-bold uppercase text-cyan-300">Përmbledhja</p>
          <div className="mt-6 flex items-center justify-between border-b border-white/[0.16] pb-5 text-sm text-white/[0.65]">
            <span>Nëntotali</span>
            <span className="font-semibold tabular-nums text-white">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-end justify-between py-6">
            <span className="font-semibold text-white">Totali</span>
            <span className="text-3xl font-extrabold tabular-nums text-white">{formatCurrency(subtotal)}</span>
          </div>
          <p className="text-sm leading-6 text-white/[0.58]">
            Stoku, transporti dhe totali final konfirmohen nga ekipi ynë pas dërgimit të porosisë.
          </p>
          <Button asChild size="lg" className="mt-6 w-full bg-cyan-400 text-[#061c28] hover:bg-cyan-300">
            <Link to="/checkout">
              Vazhdo te porosia
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </aside>
      </div>
    </section>
  );
}
