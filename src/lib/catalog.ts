import { demoCategories, demoProducts } from "@/lib/demo-data";
import { supabase } from "@/lib/supabase";
import type { Category, Product } from "@/lib/types";

export async function getCategories(): Promise<Category[]> {
  if (!supabase) return demoCategories;

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("Falling back to demo categories:", error.message);
    return demoCategories;
  }

  return data ?? demoCategories;
}

export async function getProducts(): Promise<Product[]> {
  if (!supabase) return demoProducts;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.warn("Falling back to demo products:", error.message);
    return demoProducts;
  }

  return data ?? demoProducts;
}

export async function getAdminProducts(): Promise<Product[]> {
  if (!supabase) return demoProducts;

  const { data, error } = await supabase.from("products").select("*").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const products = await getProducts();
  return products.find((product) => product.slug === slug) ?? null;
}
