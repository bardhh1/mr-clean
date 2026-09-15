import { describe, expect, it } from "vitest";
import type { OrderItemEntity } from "../orders/entities/order-item.entity";
import type { OrderEntity } from "../orders/entities/order.entity";
import { orderCreatedMessages, orderStatusMessages } from "./email-templates";

function order(overrides: Partial<OrderEntity> = {}): OrderEntity {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    reference: "MC-TEST12345678",
    idempotency_key: "22222222-2222-4222-8222-222222222222",
    request_hash: "a".repeat(64),
    customer_name: "Arta <script>alert(1)</script>",
    company_name: "Hotel & Spa",
    phone: "+38344111222",
    customer_email: "arta@example.com",
    city: "Prishtinë",
    address: "Rruga 'Test' 10",
    notes: "Lëreni te <recepsioni>",
    payment_preference: "cash_on_delivery",
    legacy_payment_preference: null,
    checkout_version: 2,
    status: "pending",
    total_cents: 1_780,
    currency: "EUR",
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  };
}

const items = [{
  name_snapshot: "Pastrues & <fortë>",
  unit_snapshot: "5L",
  quantity: 2,
  line_total_cents: 1_780
}] as OrderItemEntity[];

describe("email templates", () => {
  it("sends new-order details only to the trusted owner with escaped HTML snapshots", () => {
    const messages = orderCreatedMessages(order(), items, "owner@example.com");

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      eventType: "order.created.owner",
      recipient: "owner@example.com",
      replyTo: "arta@example.com"
    });
    expect(messages[0].textBody).toContain("17.80 EUR");
    expect(messages[0].htmlBody).toContain("&lt;script&gt;");
    expect(messages[0].htmlBody).toContain("Pastrues &amp; &lt;fortë&gt;");
    expect(messages[0].htmlBody).not.toContain("<script>");
    expect(messages[0].textBody).toContain("Lëreni te <recepsioni>");
  });

  it("does not fabricate customer delivery for migrated legacy orders", () => {
    expect(orderCreatedMessages(order({ customer_email: null }), items, "owner@example.com"))
      .toEqual([]);

    const statusMessages = orderStatusMessages(
      order({ customer_email: null, checkout_version: 1, status: "confirmed" }),
      "pending",
      "owner@example.com"
    );
    expect(statusMessages).toHaveLength(1);
    expect(statusMessages[0].eventType).toBe("order.status.owner");
  });

  it("uses transition-specific keys for status notifications", () => {
    const messages = orderStatusMessages(
      order({ status: "processing" }),
      "confirmed",
      "owner@example.com"
    );
    expect(messages.map((message) => message.deduplicationKey)).toEqual([
      "order:11111111-1111-4111-8111-111111111111:status:confirmed-to-processing:customer",
      "order:11111111-1111-4111-8111-111111111111:status:confirmed-to-processing:owner"
    ]);
  });
});
