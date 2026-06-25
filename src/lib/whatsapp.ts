import { formatCurrency } from "@/lib/format";
import type { CartItem, CheckoutInput, QuoteInput } from "@/lib/types";

const fallbackPhone = "38344123456";

export function buildWhatsAppUrl(message: string) {
  const phone = (import.meta.env.VITE_WHATSAPP_PHONE as string | undefined) || fallbackPhone;
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`;
}

export function buildOrderMessage(orderId: string, values: CheckoutInput, items: CartItem[]) {
  const total = items.reduce((sum, item) => sum + item.product.price_cents * item.quantity, 0);
  const lines = items.map(
    (item) =>
      `- ${item.product.name} x${item.quantity} (${item.product.unit}) = ${formatCurrency(
        item.product.price_cents * item.quantity
      )}`
  );

  return [
    `Porosi e re Mr. Clean: ${orderId}`,
    "",
    "Produktet:",
    ...lines,
    `Totali: ${formatCurrency(total)}`,
    "",
    `Emri: ${values.customer_name}`,
    `Biznesi: ${values.company_name || "N/A"}`,
    `Telefoni: ${values.phone}`,
    `Qyteti: ${values.city}`,
    `Adresa: ${values.address}`,
    `Pagesa: ${values.payment_preference === "cash" ? "Cash" : "Transfer bankar"}`,
    `Shënime: ${values.notes || "N/A"}`
  ].join("\n");
}

export function buildQuoteMessage(quoteId: string, values: QuoteInput, uploadedUrl?: string | null) {
  return [
    `Kërkesë për ofertë Mr. Clean: ${quoteId}`,
    "",
    "Produkt: Peceta të personalizuara",
    `Sasia: ${values.quantity}`,
    `Emri: ${values.customer_name}`,
    `Biznesi: ${values.company_name || "N/A"}`,
    `Telefoni: ${values.phone}`,
    `Detajet: ${values.notes}`,
    `Logo / referencë: ${uploadedUrl || "Do të dërgohet në WhatsApp nëse nevojitet"}`
  ].join("\n");
}
