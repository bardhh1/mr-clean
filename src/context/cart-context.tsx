import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { hasApiConfig } from "@/lib/api";
import { getProducts } from "@/lib/catalog";
import type { CartItem, Product } from "@/lib/types";

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const storageKey = "mr-clean-cart:v2";
const storageVersion = 2;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readStoredCart);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ version: storageVersion, items }));
  }, [items]);

  useEffect(() => {
    if (!hasApiConfig) return;
    let cancelled = false;
    void getProducts().then((products) => {
      if (cancelled) return;
      const productsById = new Map(products.map((product) => [product.id, product]));
      setItems((current) => current.flatMap((item) => {
        const currentProduct = productsById.get(item.product.id);
        return currentProduct
          ? [{ product: currentProduct, quantity: Math.min(999, item.quantity) }]
          : [];
      }));
    }).catch(() => {
      // Catalog screens surface connection errors; the cart remains locally recoverable.
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.product.price_cents * item.quantity, 0);

    return {
      items,
      count,
      subtotal,
      addItem(product, quantity = 1) {
        if (product.requires_quote) return;
        setItems((current) => {
          const existing = current.find((item) => item.product.id === product.id);
          if (!existing) return [...current, { product, quantity: Math.min(999, quantity) }];
          return current.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: Math.min(999, item.quantity + quantity) }
              : item
          );
        });
      },
      updateQuantity(productId, quantity) {
        setItems((current) =>
          current
            .map((item) => (
              item.product.id === productId
                ? { ...item, quantity: Math.min(999, quantity) }
                : item
            ))
            .filter((item) => item.quantity > 0)
        );
      },
      removeItem(productId) {
        setItems((current) => current.filter((item) => item.product.id !== productId));
      },
      clearCart() {
        setItems([]);
      }
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function readStoredCart(): CartItem[] {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved) as { version?: unknown; items?: unknown };
    if (parsed.version !== storageVersion || !Array.isArray(parsed.items)) return [];
    return parsed.items.filter(isCartItem);
  } catch {
    localStorage.removeItem(storageKey);
    return [];
  }
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return Boolean(
    item.product
    && typeof item.product.id === "string"
    && typeof item.quantity === "number"
    && Number.isInteger(item.quantity)
    && item.quantity > 0
    && item.quantity <= 999
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
