import { zodResolver } from "@hookform/resolvers/zod";
import { Check, FileUp, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { submitQuote } from "@/lib/orders";
import { buildQuoteMessage, buildWhatsAppUrl } from "@/lib/whatsapp";

const quoteSchema = z.object({
  customer_name: z.string().min(2, "Shkruani emrin."),
  company_name: z.string().optional(),
  phone: z.string().min(6, "Shkruani numrin e telefonit."),
  quantity: z.coerce.number().min(100, "Sasia minimale për ofertë është 100."),
  notes: z.string().min(10, "Shkruani ngjyrën, madhësinë ose detajet e logos."),
  logo_file: z.any().optional()
});

type QuoteInput = z.input<typeof quoteSchema>;
type QuoteValues = z.output<typeof quoteSchema>;

const quoteBenefits = [
  "Logo, tekst ose dizajn sipas kërkesës",
  "Formate dhe ngjyra për identitetin tuaj",
  "Ofertë sipas sasisë dhe frekuencës",
  "Konfirmim direkt në WhatsApp"
];

export function QuotePage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<QuoteInput, unknown, QuoteValues>({
    resolver: zodResolver(quoteSchema)
  });

  async function onSubmit(values: QuoteValues) {
    setSubmitting(true);
    setError(null);
    try {
      const quote = await submitQuote(values);
      const message = buildQuoteMessage(quote.id, values, quote.logo_file_url);
      window.location.assign(buildWhatsAppUrl(message));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kërkesa nuk u ruajt. Provo përsëri.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="bg-muted/45">
      <div className="relative min-h-[500px] overflow-hidden brand-ink">
        <img
          src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2000&q=88"
          alt="Tavolinë restoranti e përgatitur për klientë"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#061c28]/84" />
        <div className="container relative flex min-h-[500px] items-center py-14">
          <div className="max-w-3xl">
            <p className="flex items-center gap-3 text-xs font-bold uppercase text-cyan-300">
              <span className="h-px w-10 bg-cyan-300" />
              Peceta të personalizuara
            </p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[0.98] text-white md:text-7xl">
              Logoja juaj, në çdo tavolinë.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
              Na dërgo sasinë, formatin dhe logon. Ne kthehemi me ofertë të qartë dhe afat të
              prodhimit.
            </p>
          </div>
        </div>
      </div>

      <div className="page-shell grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
        <div>
          <p className="hairline-label">Çfarë përfshihet</p>
          <h2 className="mt-5 text-3xl font-extrabold leading-tight">E përshtatur për biznesin tënd.</h2>
          <div className="mt-7 border-t">
            {quoteBenefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 border-b py-4 text-sm font-medium">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {benefit}
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-6 text-muted-foreground">
            Sasia minimale për kërkesë është 100 copë. Për porosi të rregullta, përmend sasinë
            mujore te detajet.
          </p>
        </div>

        <form className="rounded-lg border bg-white p-5 md:p-8" onSubmit={handleSubmit(onSubmit)}>
          <div className="border-b pb-6">
            <p className="text-xs font-bold uppercase text-primary">Kërkesë e re</p>
            <h2 className="mt-2 text-2xl font-bold">Na trego çfarë të duhet</h2>
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
            <Field label="Sasia e përafërt *" error={errors.quantity?.message}>
              <Input type="number" min={100} step={50} placeholder="p.sh. 500" {...register("quantity")} />
            </Field>
          </div>
          <div className="mt-5">
            <Field label="Detajet e dizajnit *" error={errors.notes?.message}>
              <Textarea
                placeholder="Ngjyra, madhësia, lloji i logos dhe sasia mujore..."
                {...register("notes")}
              />
            </Field>
          </div>
          <div className="mt-5">
            <Field label="Logo ose referencë" error={String(errors.logo_file?.message ?? "")}>
              <div className="rounded-md border border-dashed border-input bg-muted/50 p-5 transition-colors focus-within:border-primary focus-within:bg-secondary/35">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-primary">
                    <FileUp className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Ngarko logon</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG ose PDF</p>
                  </div>
                </div>
                <Input type="file" accept="image/*,.pdf" className="bg-white" {...register("logo_file")} />
              </div>
            </Field>
          </div>
          {error ? (
            <div role="alert" className="mt-5 rounded-md border border-destructive bg-destructive/10 p-4 text-sm font-medium text-destructive">
              {error}
            </div>
          ) : null}
          <Button type="submit" size="lg" className="mt-6 w-full sm:w-auto" disabled={submitting}>
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            {submitting ? "Duke përgatitur..." : "Dërgo kërkesën në WhatsApp"}
          </Button>
        </form>
      </div>
    </section>
  );
}
