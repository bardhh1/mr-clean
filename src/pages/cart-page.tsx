import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useCart } from "@/context/cart-context";
import { formatCurrency } from "@/lib/format";

export function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <section className="container py-10">
        <EmptyState
          icon={ShoppingCart}
          title="Shporta është bosh"
          description="Shtoni produkte standarde në shportë ose kërkoni ofertë për peceta të personalizuara."
          action={<Button asChild><Link to="/produkte">Shiko produktet</Link></Button>}
        />
      </section>
    );
  }

  return (
    <section className="container py-10">
      <h1 className="text-3xl font-bold">Shporta</h1>
      <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          {items.map((item) => (
            <Card key={item.product.id}>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-[112px_1fr_auto] sm:items-center">
                <img
                  src={item.product.image_urls[0]}
                  alt={item.product.name}
                  className="aspect-square w-28 rounded-md object-cover"
                />
                <div>
                  <h2 className="font-semibold">{item.product.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{item.product.unit}</p>
                  <p className="mt-2 font-semibold">{formatCurrency(item.product.price_cents)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Ule sasinë"
                    className="flex h-11 w-11 items-center justify-center rounded-md border"
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="Rrit sasinë"
                    className="flex h-11 w-11 items-center justify-center rounded-md border"
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Largo produktin"
                    onClick={() => removeItem(item.product.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="h-fit">
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold">Përmbledhja</h2>
            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <span className="text-muted-foreground">Totali</span>
              <span className="text-2xl font-bold">{formatCurrency(subtotal)}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Totali verifikohet përsëri në Supabase gjatë krijimit të porosisë.
            </p>
            <Button asChild size="lg" className="mt-5 w-full">
              <Link to="/checkout">Vazhdo te porosia</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
