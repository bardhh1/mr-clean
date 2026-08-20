import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { useCart } from "@/context/cart-context";
import { formatCurrency } from "@/lib/format";
import { submitOrder } from "@/lib/orders";
import { buildOrderMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

const checkoutSchema = z.object({
  customer_name: z.string().min(2, "Shkruani emrin."),
  company_name: z.string().optional(),
  phone: z.string().min(6, "Shkruani numrin e telefonit."),
  city: z.string().min(2, "Shkruani qytetin."),
  address: z.string().min(4, "Shkruani adresën."),
  notes: z.string().optional(),
  payment_preference: z.enum(["cash", "bank_transfer"])
});

type CheckoutValues = z.infer<typeof checkoutSchema>;

export function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { payment_preference: "cash" }
  });

  async function onSubmit(values: CheckoutValues) {
    setSubmitting(true);
    setError(null);
    try {
      const order = await submitOrder(values, items);
      const message = buildOrderMessage(order.id, values, items);
      clearCart();
      window.location.assign(buildWhatsAppUrl(message));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Porosia nuk u ruajt. Provo përsëri.");
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <section className="page-shell min-h-[64dvh]">
        <EmptyState
          icon={MessageCircle}
          title="Nuk ka produkte për checkout"
          description="Shto produkte në shportë para se të krijosh porosinë."
          action={<Button onClick={() => navigate("/produkte")}>Shiko produktet</Button>}
        />
      </section>
    );
  }

  return (
    <section className="min-h-[70dvh] bg-muted/45">
      <div className="border-b bg-white">
        <div className="container py-8 md:py-10">
          <Link
            to="/shporta"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kthehu te shporta
          </Link>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.6fr] md:items-end">
            <div>
              <p className="hairline-label">Hapi i fundit</p>
              <h1 className="mt-4 text-4xl font-extrabold md:text-6xl">Përfundo porosinë</h1>
            </div>
            <p className="text-sm leading-6 text-muted-foreground md:justify-self-end">
              Të dhënat ruhen si porosi dhe WhatsApp hapet me përmbledhjen gati për dërgim.
            </p>
          </div>
        </div>
      </div>

      <form className="page-shell grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start" onSubmit={handleSubmit(onSubmit)}>
        <div className="rounded-lg border bg-white p-5 md:p-8">
          <div className="flex items-start gap-4 border-b pb-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-bold text-primary">01</span>
            <div>
              <h2 className="text-xl font-bold">Të dhënat e klientit</h2>
              <p className="mt-1 text-sm text-muted-foreground">Përdoren për konfirmimin dhe dorëzimin e porosisë.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Field label="Emri dhe mbiemri *" error={errors.customer_name?.message}>
              <Input autoComplete="name" {...register("customer_name")} />
            </Field>
            <Field label="Emri i biznesit" error={errors.company_name?.message}>
              <Input autoComplete="organization" {...register("company_name")} />
            </Field>
            <Field label="Telefoni *" error={errors.phone?.message}>
              <Input type="tel" autoComplete="tel" {...register("phone")} />
            </Field>
            <Field label="Qyteti *" error={errors.city?.message}>
              <Input autoComplete="address-level2" {...register("city")} />
            </Field>
          </div>
          <div className="mt-5">
            <Field label="Adresa e dorëzimit *" error={errors.address?.message}>
              <Input autoComplete="street-address" {...register("address")} />
            </Field>
          </div>

          <div className="mt-8 flex items-start gap-4 border-y py-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-sm font-bold text-primary">02</span>
            <div>
              <h2 className="text-xl font-bold">Pagesa dhe shënimet</h2>
              <p className="mt-1 text-sm text-muted-foreground">Zgjidh mënyrën e preferuar. Detajet konfirmohen në WhatsApp.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-5">
            <Field label="Mënyra e pagesës *" error={errors.payment_preference?.message}>
              <Select {...register("payment_preference")}>
                <option value="cash">Cash gjatë dorëzimit</option>
                <option value="bank_transfer">Transfer bankar</option>
              </Select>
            </Field>
            <Field label="Shënime për porosinë" error={errors.notes?.message}>
              <Textarea placeholder="Orari i dorëzimit, hyrja, personi kontaktues..." {...register("notes")} />
            </Field>
          </div>

          {error ? (
            <div role="alert" className="mt-5 rounded-md border border-destructive bg-destructive/10 p-4 text-sm font-medium text-destructive">
              {error}
            </div>
          ) : null}
        </div>

        <aside className="brand-ink rounded-lg p-6 lg:sticky lg:top-36">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            <h2 className="font-bold text-white">Përmbledhja e porosisë</h2>
          </div>
          <div className="mt-5 grid gap-4 border-y border-white/[0.16] py-5">
            {items.map((item) => (
              <div key={item.product.id} className="flex justify-between gap-4 text-sm">
                <span className="max-w-[220px] text-white/[0.62]">
                  {item.product.name} × {item.quantity}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-white">
                  {formatCurrency(item.product.price_cents * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-end justify-between py-6">
            <span className="font-semibold text-white">Totali</span>
            <span className="text-3xl font-extrabold tabular-nums text-white">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex gap-3 border-t border-white/[0.16] pt-5 text-xs leading-5 text-white/[0.56]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
            Porosia nuk është përfundimtare derisa ta konfirmojë ekipi ynë.
          </div>
          <Button
            type="submit"
            size="lg"
            className="mt-6 w-full bg-cyan-400 text-[#061c28] hover:bg-cyan-300"
            disabled={submitting}
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            {submitting ? "Duke përgatitur..." : "Vazhdo në WhatsApp"}
          </Button>
        </aside>
      </form>
    </section>
  );
}
