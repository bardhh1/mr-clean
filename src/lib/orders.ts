import { orderReference } from "@/lib/format";
import { supabase } from "@/lib/supabase";
import type { CartItem, CheckoutInput, OrderRecord } from "@/lib/types";

export async function submitOrder(values: CheckoutInput, items: CartItem[]) {
  const total = items.reduce((sum, item) => sum + item.product.price_cents * item.quantity, 0);

  if (!supabase) {
    return {
      id: orderReference(),
      total_cents: total,
      currency: "EUR" as const,
      status: "pending_whatsapp" as const,
      ...values
    };
  }

  const payload = {
    order: values,
    items: items.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity
    }))
  };

  const { data: rpcData, error: rpcError } = await supabase.rpc("create_order_from_cart", payload);
  if (!rpcError && rpcData) return rpcData as OrderRecord;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      ...values,
      total_cents: total,
      currency: "EUR",
      status: "pending_whatsapp"
    })
    .select("*")
    .single();

  if (orderError) throw orderError;

  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.product.id,
    name_snapshot: item.product.name,
    quantity: item.quantity,
    unit_price_cents: item.product.price_cents,
    line_total_cents: item.product.price_cents * item.quantity
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) throw itemsError;

  return order as OrderRecord;
}

export async function getOrders() {
  if (!supabase) return [] as OrderRecord[];
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrderRecord[];
}
