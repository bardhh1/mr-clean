import type { OrderItemEntity } from "../orders/entities/order-item.entity";
import type { OrderEntity, OrderStatus } from "../orders/entities/order.entity";
import type { EmailEventType } from "./entities/email-outbox.entity";

export type EmailMessage = {
  deduplicationKey: string;
  eventType: EmailEventType;
  recipient: string;
  replyTo: string | null;
  subject: string;
  textBody: string;
  htmlBody: string;
};

const statusLabels: Record<OrderStatus, string> = {
  pending: "në pritje",
  confirmed: "e konfirmuar",
  processing: "në përgatitje",
  shipped: "e nisur për dorëzim",
  delivered: "e dorëzuar",
  cancelled: "e anuluar"
};

export function orderCreatedMessages(
  order: OrderEntity,
  items: OrderItemEntity[],
  ownerEmail: string
): EmailMessage[] {
  if (!order.customer_email) return [];

  const itemLines = items.map((item) =>
    `${item.quantity} × ${item.name_snapshot} (${item.unit_snapshot}) — ${money(item.line_total_cents)}`
  );
  const ownerText = [
    `Porosi e re ${order.reference}`,
    "",
    `Klienti: ${order.customer_name}`,
    `Email: ${order.customer_email}`,
    `Telefoni: ${order.phone}`,
    order.company_name ? `Biznesi: ${order.company_name}` : null,
    `Adresa: ${order.address}, ${order.city}`,
    ...itemLines.map((line) => `- ${line}`),
    `Totali: ${money(order.total_cents)}`,
    order.notes ? `Shënime: ${order.notes}` : null
  ].filter((line): line is string => line !== null).join("\n");

  return [{
    deduplicationKey: `order:${order.id}:created:owner`,
    eventType: "order.created.owner",
    recipient: ownerEmail,
    replyTo: order.customer_email,
    subject: `Porosi e re ${order.reference}`,
    textBody: ownerText,
    htmlBody: renderHtml(ownerText)
  }];
}

export function orderStatusMessages(
  order: OrderEntity,
  previousStatus: OrderStatus,
  ownerEmail: string
): EmailMessage[] {
  const label = statusLabels[order.status];
  const transitionKey = `${previousStatus}-to-${order.status}`;
  const ownerText = [
    `Statusi i porosisë ${order.reference} ndryshoi.`,
    `Nga: ${statusLabels[previousStatus]}`,
    `Në: ${label}`,
    `Klienti: ${order.customer_name}`,
    order.customer_email ? `Email: ${order.customer_email}` : null,
    `Telefoni: ${order.phone}`
  ].filter((line): line is string => line !== null).join("\n");
  const messages: EmailMessage[] = [{
    deduplicationKey: `order:${order.id}:status:${transitionKey}:owner`,
    eventType: "order.status.owner",
    recipient: ownerEmail,
    replyTo: order.customer_email,
    subject: `${order.reference}: ${label}`,
    textBody: ownerText,
    htmlBody: renderHtml(ownerText)
  }];

  if (order.customer_email) {
    const customerText = [
      `Përshëndetje ${order.customer_name},`,
      "",
      `Porosia ${order.reference} tani është ${label}.`,
      `Totali: ${money(order.total_cents)}`,
      "Pagesa: cash gjatë dorëzimit"
    ].join("\n");
    messages.unshift({
      deduplicationKey: `order:${order.id}:status:${transitionKey}:customer`,
      eventType: "order.status.customer",
      recipient: order.customer_email,
      replyTo: ownerEmail,
      subject: `${order.reference}: ${label}`,
      textBody: customerText,
      htmlBody: renderHtml(customerText)
    });
  }

  return messages;
}

function money(cents: number): string {
  return `${(cents / 100).toFixed(2)} EUR`;
}

function renderHtml(text: string): string {
  return `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#172016;white-space:pre-line">${escapeHtml(text)}</div>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[character] ?? character);
}
