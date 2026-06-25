export function formatCurrency(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("sq-XK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format(cents / 100);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function orderReference(prefix = "MC") {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}
