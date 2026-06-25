import { zodResolver } from "@hookform/resolvers/zod";
import { FileUp, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <section className="container py-10">
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1fr] lg:items-start">
        <div>
          <p className="text-sm font-semibold text-primary">Peceta të personalizuara</p>
          <h1 className="mt-2 text-3xl font-bold md:text-5xl">Kërko ofertë me logon e biznesit</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            Dërgoni sasinë, stilin dhe logon. Mr. Clean ju kontakton në WhatsApp me ofertë dhe
            afat prodhimi.
          </p>
          <img
            src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80"
            alt="Tavolinë restoranti me peceta dhe servis"
            className="mt-7 aspect-[4/3] w-full rounded-lg object-cover shadow-soft"
          />
        </div>
        <Card>
          <CardContent className="p-5">
            <form className="grid gap-5" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Emri" error={errors.customer_name?.message}>
                  <Input autoComplete="name" {...register("customer_name")} />
                </Field>
                <Field label="Biznesi" error={errors.company_name?.message}>
                  <Input autoComplete="organization" {...register("company_name")} />
                </Field>
                <Field label="Telefoni" error={errors.phone?.message}>
                  <Input type="tel" autoComplete="tel" {...register("phone")} />
                </Field>
                <Field label="Sasia" error={errors.quantity?.message}>
                  <Input type="number" min={100} step={50} {...register("quantity")} />
                </Field>
              </div>
              <Field label="Detajet e dizajnit" error={errors.notes?.message}>
                <Textarea
                  placeholder="P.sh. logo njëngjyrëshe, peceta të zeza 33x33, sasi mujore..."
                  {...register("notes")}
                />
              </Field>
              <Field label="Logo ose referencë" error={String(errors.logo_file?.message ?? "")}>
                <div className="rounded-md border border-dashed bg-background p-4">
                  <FileUp className="mb-2 h-5 w-5 text-primary" aria-hidden="true" />
                  <Input type="file" accept="image/*,.pdf" {...register("logo_file")} />
                </div>
              </Field>
              {error ? (
                <div role="alert" className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              <Button type="submit" size="lg" disabled={submitting}>
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                {submitting ? "Duke dërguar..." : "Dërgo kërkesën"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
