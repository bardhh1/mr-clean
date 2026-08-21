import { apiRequest, hasApiConfig } from "@/lib/api";
import { orderReference } from "@/lib/format";
import type { CartItem, CheckoutInput, OrderReceipt, OrderRecord } from "@/lib/types";

export async function submitOrder(
  values: CheckoutInput,
  items: CartItem[]
): Promise<OrderReceipt> {
  const total = items.reduce((sum, item) => sum + item.product.price_cents * item.quantity, 0);
  const attempt = orderAttempt(values, items);

  if (!hasApiConfig) {
    const reference = orderReference();
    clearOrderAttempt(attempt.signature);
    return {
      id: reference,
      reference,
      total_cents: total,
      currency: "EUR" as const,
      status: "pending_whatsapp" as const,
      ...values
    };
  }

  const receipt = await apiRequest<OrderReceipt>("/orders", {
    method: "POST",
    body: {
      idempotency_key: attempt.key,
      ...values,
      company_name: values.company_name || undefined,
      notes: values.notes || undefined,
      items: items.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity
      }))
    }
  });
  clearOrderAttempt(attempt.signature);
  return receipt;
}

export async function getOrders(): Promise<OrderRecord[]> {
  const response = await apiRequest<{ data: OrderRecord[] }>("/admin/orders?limit=100");
  return response.data;
}

export async function getOrder(orderId: string): Promise<OrderRecord> {
  return apiRequest<OrderRecord>(`/admin/orders/${orderId}`);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderRecord["status"]
): Promise<OrderRecord> {
  return apiRequest<OrderRecord>(`/admin/orders/${orderId}/status`, {
    method: "PATCH",
    body: { status }
  });
}

const orderAttemptStorageKey = "mr-clean-order-attempt:v1";

function orderAttempt(values: CheckoutInput, items: CartItem[]) {
  const signature = JSON.stringify({
    values,
    items: items.map((item) => ({ id: item.product.id, quantity: item.quantity }))
  });
  const saved = readOrderAttempt();
  if (saved?.signature === signature) return saved;

  const attempt = { signature, key: window.crypto.randomUUID() };
  window.sessionStorage.setItem(orderAttemptStorageKey, JSON.stringify(attempt));
  return attempt;
}

function readOrderAttempt(): { signature: string; key: string } | null {
  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(orderAttemptStorageKey) ?? "null"
    ) as { signature?: unknown; key?: unknown } | null;
    return parsed
      && typeof parsed.signature === "string"
      && typeof parsed.key === "string"
      ? { signature: parsed.signature, key: parsed.key }
      : null;
  } catch {
    window.sessionStorage.removeItem(orderAttemptStorageKey);
    return null;
  }
}

function clearOrderAttempt(signature: string): void {
  if (readOrderAttempt()?.signature === signature) {
    window.sessionStorage.removeItem(orderAttemptStorageKey);
  }
}
