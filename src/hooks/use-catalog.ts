import { useEffect, useState } from "react";
import { getCategories, getProducts } from "@/lib/catalog";
import type { Category, Product } from "@/lib/types";

export function useCatalog() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [nextCategories, nextProducts] = await Promise.all([getCategories(), getProducts()]);
        if (!cancelled) {
          setCategories(nextCategories);
          setProducts(nextProducts);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Nuk u lexuan produktet.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, products, loading, error };
}
