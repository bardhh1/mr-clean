import type { QueryRunner } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import { CashOnDeliveryCheckout1789516800000 } from "./1789516800000-cash-on-delivery-checkout";

function runner() {
  const queries: string[] = [];
  return {
    queries,
    queryRunner: {
      query: vi.fn().mockImplementation((sql: string) => {
        queries.push(sql);
        return Promise.resolve();
      })
    } as unknown as QueryRunner
  };
}

describe("CashOnDeliveryCheckout1789516800000", () => {
  it("migrates legacy orders, adds immutable snapshots, and creates a constrained outbox", async () => {
    const { queries, queryRunner } = runner();
    await new CashOnDeliveryCheckout1789516800000().up(queryRunner);
    const sql = queries.join("\n");

    expect(sql).toContain(`WHEN "status" = 'pending_whatsapp' THEN 'pending'`);
    expect(sql).toContain(`"payment_preference" = 'cash_on_delivery'`);
    expect(sql).toContain("prevent_order_financial_mutation");
    expect(sql).toContain("prevent_order_item_snapshot_mutation");
    expect(sql).toContain(`CREATE TABLE "email_outbox"`);
    expect(sql).toContain("uq_email_outbox_deduplication_key");
  });

  it("provides a deterministic legacy-compatible rollback", async () => {
    const { queries, queryRunner } = runner();
    await new CashOnDeliveryCheckout1789516800000().down(queryRunner);
    const sql = queries.join("\n");

    expect(sql).toContain(`WHEN "status" = 'delivered' THEN 'completed'`);
    expect(sql).toContain(`COALESCE("legacy_payment_preference", 'cash')`);
    expect(sql).toContain(`DROP TABLE IF EXISTS "email_outbox"`);
  });
});
