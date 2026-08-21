import { demoCategories, demoProducts } from "@/lib/demo-data";
import { apiRequest, hasApiConfig } from "@/lib/api";
import type { Category, Product } from "@/lib/types";

type ProductListResponse = {
  data: Product[];
};

let categoriesRequest: Promise<Category[]> | null = null;
let productsRequest: Promise<Product[]> | null = null;
let categoriesExpireAt = 0;
let productsExpireAt = 0;
const publicCacheLifetimeMs = 10 * 60 * 1_000;

export async function getCategories(): Promise<Category[]> {
  if (!hasApiConfig) return demoCategories;
  if (!categoriesRequest || Date.now() >= categoriesExpireAt) {
    categoriesExpireAt = Date.now() + publicCacheLifetimeMs;
    categoriesRequest = apiRequest<Category[]>("/categories").catch((error: unknown) => {
      categoriesRequest = null;
      categoriesExpireAt = 0;
      throw error;
    });
  }
  return categoriesRequest;
}

export async function getProducts(): Promise<Product[]> {
  if (!hasApiConfig) return demoProducts;
  if (!productsRequest || Date.now() >= productsExpireAt) {
    productsExpireAt = Date.now() + publicCacheLifetimeMs;
    productsRequest = apiRequest<ProductListResponse>("/products?limit=100").then(
      (response) => response.data
    ).catch((error: unknown) => {
      productsRequest = null;
      productsExpireAt = 0;
      throw error;
    });
  }
  return productsRequest;
}

export async function getAdminProducts(): Promise<Product[]> {
  return apiRequest<Product[]>("/admin/products");
}

export async function getAdminCategories(): Promise<Category[]> {
  return apiRequest<Category[]>("/admin/categories");
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!hasApiConfig) {
    return demoProducts.find((product) => product.slug === slug) ?? null;
  }
  try {
    return await apiRequest<Product>(`/products/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 404) return null;
    throw error;
  }
}

export function invalidateCatalogCache(): void {
  categoriesRequest = null;
  productsRequest = null;
  categoriesExpireAt = 0;
  productsExpireAt = 0;
}
