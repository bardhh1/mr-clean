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
};

export type CartItem = {
  product: Product;
  quantity: number;
};

export type CheckoutInput = {
  customer_name: string;
  company_name?: string;
  phone: string;
  city: string;
  address: string;
  notes?: string;
  payment_preference: "cash" | "bank_transfer";
};

export type OrderReceipt = {
  id: string;
  reference: string;
  total_cents: number;
  currency: "EUR";
  status: "pending_whatsapp" | "confirmed" | "completed" | "cancelled";
  created_at?: string;
};

export type OrderRecord = CheckoutInput & OrderReceipt & {
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
