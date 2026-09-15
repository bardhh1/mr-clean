export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Product = {
  id: string;
  catalog_code: string | null;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  currency: "EUR";
  unit: string;
  image_urls: string[];
  image_keys?: string[];
  is_active: boolean;
  is_featured: boolean;
  requires_quote: boolean;
  stock_label: string;
  category?: Category;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type CheckoutInput = {
  customer_name: string;
  company_name?: string;
  phone: string;
  customer_email: string;
  city: string;
  address: string;
  notes?: string;
  turnstile_token?: string;
};

export type OrderStatus = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled";

export type OrderReceipt = {
  id: string;
  reference: string;
  total_cents: number;
  currency: "EUR";
  status: OrderStatus;
  created_at?: string;
};

export type OrderRecord = OrderReceipt & {
  customer_name: string;
  company_name: string | null;
  phone: string;
  customer_email: string | null;
  city: string;
  address: string;
  notes: string | null;
  payment_preference: "cash_on_delivery";
  legacy_payment_preference?: "cash" | "bank_transfer" | null;
  checkout_version: 1 | 2;
  updated_at?: string;
  items?: Array<{
    id: string;
    product_id: string | null;
    name: string;
    unit: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  }>;
};
