import { slugify } from "@/lib/format";
import { ApiError, apiRequest, invalidateAdminSessionRefresh } from "@/lib/api";
import { invalidateCatalogCache } from "@/lib/catalog";
import type { Category, Product } from "@/lib/types";

export async function signInAdmin(email: string, password: string) {
  return apiRequest<{ user: AdminUser }>("/admin/auth/login", {
    method: "POST",
    body: { email, password },
    retryAuth: false
  });
}

export async function signOutAdmin(): Promise<void> {
  await apiRequest<void>("/admin/auth/logout", {
    method: "POST",
    retryAuth: false
  });
  invalidateAdminSessionRefresh();
}

export async function getSessionUser(): Promise<AdminUser | null> {
  try {
    const response = await apiRequest<{ user: AdminUser }>("/admin/auth/me");
    return response.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function upsertCategory(category: Partial<Category> & { name: string }) {
  const payload = {
    slug: category.slug || slugify(category.name),
    name: category.name,
    description: category.description || null,
    sort_order: category.sort_order ?? 99,
    is_active: category.is_active ?? true
  };
  const result = await apiRequest<Category>(
    category.id ? `/admin/categories/${category.id}` : "/admin/categories",
    { method: category.id ? "PATCH" : "POST", body: payload }
  );
  invalidateCatalogCache();
  return result;
}

export async function upsertProduct(product: Partial<Product> & { name: string; category_id: string }) {
  const payload = {
    category_id: product.category_id,
    name: product.name,
    slug: product.slug || slugify(product.name),
    description: product.description,
    price_cents: product.price_cents,
    unit: product.unit,
    image_urls: product.image_urls ?? [],
    image_keys: product.image_keys ?? [],
    is_active: product.is_active ?? true,
    is_featured: product.is_featured ?? false,
    requires_quote: product.requires_quote ?? false,
    stock_label: product.stock_label || "Në stok"
  };
  const result = await apiRequest<Product>(
    product.id ? `/admin/products/${product.id}` : "/admin/products",
    { method: product.id ? "PATCH" : "POST", body: payload }
  );
  invalidateCatalogCache();
  return result;
}

export async function updateProductStatus(productId: string, values: Partial<Product>) {
  const result = await apiRequest<Product>(`/admin/products/${productId}`, {
    method: "PATCH",
    body: values
  });
  invalidateCatalogCache();
  return result;
}

export async function uploadProductImage(file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiRequest<UploadResult>("/admin/uploads/product-images", {
    method: "POST",
    body
  });
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await apiRequest<void>(`/admin/categories/${categoryId}`, { method: "DELETE" });
  invalidateCatalogCache();
}

export async function deleteProduct(productId: string): Promise<void> {
  await apiRequest<void>(`/admin/products/${productId}`, { method: "DELETE" });
  invalidateCatalogCache();
}

export async function deleteProductImage(key: string): Promise<void> {
  await apiRequest<void>(`/admin/uploads/product-images?key=${encodeURIComponent(key)}`, {
    method: "DELETE"
  });
}

type AdminUser = {
  id: string;
  email: string;
  role: "admin";
};

export type UploadResult = {
  key: string;
  url: string;
  expires_in: number;
};
