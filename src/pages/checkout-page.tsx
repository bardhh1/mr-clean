import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { PageIntro, PosterFrame } from "@/components/poster";
import { TurnstileWidget } from "@/components/turnstile-widget";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useCart } from "@/context/cart-context";
import { formatCurrency } from "@/lib/format";
import { submitOrder } from "@/lib/orders";
import type { OrderReceipt } from "@/lib/types";

const checkoutSchema = z.object({
  customer_name: z.string().min(2, "Shkruani emrin."),
  company_name: z.string().optional(),
  phone: z.string().min(6, "Shkruani numrin e telefonit."),
  customer_email: z.email("Shkruani një email të vlefshëm."),
  city: z.string().min(2, "Shkruani qytetin."),
  address: z.string().min(4, "Shkruani adresën."),
  notes: z.string().optional()
});

type CheckoutValues = z.infer<typeof checkoutSchema>;
const turnstileSiteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim();
const turnstileRequired = import.meta.env.PROD;

export function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ order: OrderReceipt; email: string } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema)
  });
  async function onSubmit(values: CheckoutValues) {
    if (turnstileRequired && !turnstileToken) {
      setError("Përfundoni verifikimin e sigurisë para se të dërgoni porosinë.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const order = await submitOrder({
        ...values,
        turnstile_token: turnstileToken ?? undefined
      }, items);
      setSuccess({ order, email: values.customer_email });
      clearCart();
    } catch (err) {
      setTurnstileToken(null);
      setTurnstileReset((value) => value + 1);
      setError(err instanceof Error ? err.message : "Porosia nuk u ruajt. Provo përsëri.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <PosterFrame>
        <div className="poster-page min-h-dvh">
          <PageIntro title="Porosia u pranua" />
          <EmptyState
            icon={CheckCircle2}
            title={`Faleminderit — ${success.order.reference}`}
            description={`Kërkesa prej ${formatCurrency(success.order.total_cents)} u ruajt. Pasi ekipi ta konfirmojë porosinë, njoftimi do të dërgohet te ${success.email}; pagesa bëhet cash gjatë dorëzimit.`}
            action={<button className="poster-cta" type="button" onClick={() => navigate("/produkte")}>Vazhdo te produktet</button>}
          />
        </div>
      </PosterFrame>
    );
  }

  if (items.length === 0) {
    return (
      <PosterFrame>
        <div className="poster-page min-h-dvh">
          <PageIntro title="Përfundo porosinë" />
          <EmptyState icon={ShoppingCart} title="Nuk ka produkte për porosi" description="Shto produkte në shportë para se të krijosh porosinë." action={<button className="poster-cta" type="button" onClick={() => navigate("/produkte")}>Shiko produktet</button>} />
        </div>
      </PosterFrame>
    );
  }

  return (
    <PosterFrame>
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
              <Field label="Email" error={errors.customer_email?.message}><Input placeholder="emri@biznesi.com" type="email" autoComplete="email" {...register("customer_email")} /></Field>
              <Field label="Qyteti" error={errors.city?.message}><Input placeholder="Shkruani qytetin" autoComplete="address-level2" {...register("city")} /></Field>
              <div className="md:col-span-2"><Field label="Adresa e dorëzimit" error={errors.address?.message}><Input placeholder="Shkruani adresën e plotë të dorëzimit" autoComplete="street-address" {...register("address")} /></Field></div>
            </div>

            <div className="payment-notes">
              <fieldset>
                <legend>Mënyra e pagesës</legend>
                <p><strong>Cash gjatë dorëzimit</strong><br />Pagesa i bëhet korrierit kur porosia dorëzohet.</p>
              </fieldset>
              <Field label="Shënime për porosinë" error={errors.notes?.message}><Textarea placeholder="Shtoni ndonjë shënim për porosinë..." {...register("notes")} /></Field>
            </div>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
          </div>

          <aside className="order-summary checkout-summary">
            <p><span>Nëntotali</span><strong>{formatCurrency(subtotal)}</strong></p>
            <p className="order-summary__total"><span>Totali</span><strong>{formatCurrency(subtotal)}</strong></p>
            <span className="locator-bar" aria-hidden="true" />
            {turnstileSiteKey ? (
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                resetSignal={turnstileReset}
                onToken={setTurnstileToken}
                onUnavailable={() => setError("Verifikimi i sigurisë nuk u ngarkua. Rifreskoni faqen dhe provoni përsëri.")}
              />
            ) : turnstileRequired ? (
              <p className="form-error" role="alert">Verifikimi i sigurisë nuk është konfiguruar.</p>
            ) : null}
            <small>Totali verifikohet nga serveri. Emaili dërgohet pasi ekipi ta konfirmojë porosinë.</small>
            <button className="poster-cta poster-cta--light" type="submit" disabled={submitting || (turnstileRequired && !turnstileToken)}><CheckCircle2 aria-hidden="true" />{submitting ? "Duke ruajtur..." : "Konfirmo porosinë"}</button>
          </aside>
        </form>
      </div>
    </PosterFrame>
  );
}
