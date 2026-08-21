import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MessageCircle, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { ContextRail, PageIntro, PosterFrame } from "@/components/poster";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/form";
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

const checkoutSteps = [
  { number: "01", label: "Shporta" },
  { number: "02", label: "Të dhënat", active: true },
  { number: "03", label: "Pagesa" },
  { number: "04", label: "WhatsApp" }
];

export function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { payment_preference: "cash" }
  });
  const rail = <ContextRail items={checkoutSteps} footer="Porosi · Konfirmim · Dorëzim" />;

  async function onSubmit(values: CheckoutValues) {
    setSubmitting(true);
    setError(null);
    try {
      const order = await submitOrder(values, items);
      const message = buildOrderMessage(
        order.reference,
        values,
        items,
        order.total_cents
      );
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
      <PosterFrame rail={rail}>
        <div className="poster-page min-h-dvh">
          <PageIntro title="Përfundo porosinë" />
          <EmptyState icon={ShoppingCart} title="Nuk ka produkte për porosi" description="Shto produkte në shportë para se të krijosh porosinë." action={<button className="poster-cta" type="button" onClick={() => navigate("/produkte")}>Shiko produktet</button>} />
        </div>
      </PosterFrame>
    );
  }

  return (
    <PosterFrame rail={rail}>
      <div className="checkout-page poster-page">
        <PageIntro title={<>Përfundo<br />porosinë</>} aside={<img src="/design/quality-stamp.png" alt="Pastërti profesionale" />} />
        <div className="checkout-meta"><Link to="/shporta"><ArrowLeft aria-hidden="true" />Kthehu te shporta</Link><strong>{items.length} artikuj</strong></div>

        <div className="checkout-ledger">
          {items.map((item) => (
            <div key={item.product.id}>
              <img src={item.product.image_urls[0]} alt="" />
              <span>{item.product.name}<small>{item.product.unit}</small></span>
              <strong>{formatCurrency(item.product.price_cents * item.quantity)}</strong>
              <i>{item.quantity}</i>
            </div>
          ))}
        </div>

        <form className="checkout-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="checkout-fields">
            <h2>Të dhënat e klientit</h2>
            <div className="field-grid">
              <Field label="Emri dhe mbiemri" error={errors.customer_name?.message}><Input placeholder="Shkruani emrin dhe mbiemrin" autoComplete="name" {...register("customer_name")} /></Field>
              <Field label="Emri i biznesit" error={errors.company_name?.message}><Input placeholder="Shkruani emrin e biznesit" autoComplete="organization" {...register("company_name")} /></Field>
              <Field label="Telefoni" error={errors.phone?.message}><Input placeholder="+355 69 123 4567" type="tel" autoComplete="tel" {...register("phone")} /></Field>
              <Field label="Qyteti" error={errors.city?.message}><Input placeholder="Shkruani qytetin" autoComplete="address-level2" {...register("city")} /></Field>
              <div className="md:col-span-2"><Field label="Adresa e dorëzimit" error={errors.address?.message}><Input placeholder="Shkruani adresën e plotë të dorëzimit" autoComplete="street-address" {...register("address")} /></Field></div>
            </div>

            <div className="payment-notes">
              <fieldset>
                <legend>Mënyra e pagesës</legend>
                <label><input type="radio" value="cash" {...register("payment_preference")} /><span />Cash gjatë dorëzimit</label>
                <label><input type="radio" value="bank_transfer" {...register("payment_preference")} /><span />Transfer bankar</label>
              </fieldset>
              <Field label="Shënime për porosinë" error={errors.notes?.message}><Textarea placeholder="Shtoni ndonjë shënim për porosinë..." {...register("notes")} /></Field>
            </div>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
          </div>

          <aside className="order-summary checkout-summary">
            <p><span>Nëntotali</span><strong>{formatCurrency(subtotal)}</strong></p>
            <p className="order-summary__total"><span>Totali</span><strong>{formatCurrency(subtotal)}</strong></p>
            <span className="locator-bar" aria-hidden="true" />
            <small>Duke vazhduar, porosia juaj do të përgatitet dhe do të konfirmohet në WhatsApp.</small>
            <button className="poster-cta poster-cta--light" type="submit" disabled={submitting}><MessageCircle aria-hidden="true" />{submitting ? "Duke përgatitur..." : "Vazhdo në WhatsApp"}</button>
          </aside>
        </form>
      </div>
    </PosterFrame>
  );
}
