import { zodResolver } from "@hookform/resolvers/zod";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <section className="container py-10">
        <EmptyState
          icon={MessageCircle}
          title="Nuk ka produkte për checkout"
          description="Shtoni produkte në shportë para se të krijoni porosinë."
          action={<Button onClick={() => navigate("/produkte")}>Shiko produktet</Button>}
        />
      </section>
    );
  }

  return (
    <section className="container py-10">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-primary">Checkout</p>
        <h1 className="mt-2 text-3xl font-bold">Dërgo porosinë në WhatsApp</h1>
        <p className="mt-3 text-muted-foreground">
          Plotësoni të dhënat, porosia ruhet dhe hapet WhatsApp me mesazh të përgatitur.
        </p>
      </div>
      <form className="mt-7 grid gap-6 lg:grid-cols-[1fr_360px]" onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="grid gap-5 p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Emri dhe mbiemri" error={errors.customer_name?.message}>
                <Input autoComplete="name" {...register("customer_name")} />
              </Field>
              <Field label="Emri i biznesit" error={errors.company_name?.message}>
                <Input autoComplete="organization" {...register("company_name")} />
              </Field>
              <Field label="Telefoni" error={errors.phone?.message}>
                <Input type="tel" autoComplete="tel" {...register("phone")} />
              </Field>
              <Field label="Qyteti" error={errors.city?.message}>
                <Input autoComplete="address-level2" {...register("city")} />
              </Field>
            </div>
            <Field label="Adresa" error={errors.address?.message}>
              <Input autoComplete="street-address" {...register("address")} />
            </Field>
            <Field label="Pagesa" error={errors.payment_preference?.message}>
              <Select {...register("payment_preference")}>
                <option value="cash">Cash gjatë dorëzimit</option>
                <option value="bank_transfer">Transfer bankar</option>
              </Select>
            </Field>
            <Field label="Shënime" error={errors.notes?.message}>
              <Textarea placeholder="Orari i dorëzimit, hyrja, personi kontaktues..." {...register("notes")} />
            </Field>
            {error ? (
              <div role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="font-semibold">Porosia</h2>
            </div>
            <div className="mt-4 grid gap-3">
              {items.map((item) => (
                <div key={item.product.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {item.product.name} x{item.quantity}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(item.product.price_cents * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t pt-4">
              <span className="font-semibold">Totali</span>
              <span className="text-xl font-bold">{formatCurrency(subtotal)}</span>
            </div>
            <Button type="submit" size="lg" className="mt-5 w-full" disabled={submitting}>
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              {submitting ? "Duke dërguar..." : "Hap WhatsApp"}
            </Button>
            <Button asChild variant="ghost" className="mt-2 w-full">
              <Link to="/shporta">Kthehu te shporta</Link>
            </Button>
          </CardContent>
        </Card>
      </form>
    </section>
  );
}
