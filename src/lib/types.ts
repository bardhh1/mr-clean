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

export type QuoteInput = {
  customer_name: string;
  company_name?: string;
  phone: string;
  quantity: number;
  notes: string;
  logo_file?: FileList;
};

export type OrderRecord = CheckoutInput & {
  id: string;
  total_cents: number;
  currency: "EUR";
  status: "pending_whatsapp" | "confirmed" | "completed" | "cancelled";
  created_at?: string;
};

export type QuoteRecord = {
  id: string;
  customer_name: string;
  company_name: string | null;
  phone: string;
  quantity: number;
  notes: string;
  logo_file_url: string | null;
  status: "new" | "contacted" | "quoted" | "closed";
  created_at?: string;
};
