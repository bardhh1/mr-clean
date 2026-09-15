const fallbackPhone = "38344123456";

export function buildWhatsAppUrl(message: string) {
  const phone = (import.meta.env.VITE_WHATSAPP_PHONE as string | undefined) || fallbackPhone;
  return `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(message)}`;
}
