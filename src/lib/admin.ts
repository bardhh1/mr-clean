import { slugify } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { Category, Product } from "@/lib/types";

export async function signInAdmin(email: string, password: string) {
  if (!supabase) throw new Error("Vendos VITE_SUPABASE_URL dhe VITE_SUPABASE_ANON_KEY në .env.");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOutAdmin() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSessionUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function upsertCategory(category: Partial<Category> & { name: string }) {
  if (!supabase) throw new Error("Supabase nuk është konfiguruar.");
  const payload = {
    ...category,
    slug: category.slug || slugify(category.name),
    description: category.description || null,
    sort_order: category.sort_order ?? 99,
    is_active: category.is_active ?? true
  };
  const { error } = await supabase.from("categories").upsert(payload);
  if (error) throw error;
}

export async function upsertProduct(product: Partial<Product> & { name: string; category_id: string }) {
  if (!supabase) throw new Error("Supabase nuk është konfiguruar.");
  const payload = {
    ...product,
    slug: product.slug || slugify(product.name),
    currency: "EUR",
    image_urls: product.image_urls ?? [],
    is_active: product.is_active ?? true,
    is_featured: product.is_featured ?? false,
    requires_quote: product.requires_quote ?? false,
    stock_label: product.stock_label || "Në stok"
  };
  const { error } = await supabase.from("products").upsert(payload);
  if (error) throw error;
}

export async function updateProductStatus(productId: string, values: Partial<Product>) {
  if (!supabase) throw new Error("Supabase nuk është konfiguruar.");
  const { error } = await supabase.from("products").update(values).eq("id", productId);
  if (error) throw error;
}

export async function uploadProductImage(file: File) {
  if (!supabase) throw new Error("Supabase nuk është konfiguruar.");
  const path = `${Date.now()}-${slugify(file.name)}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}
