import type { QueryRunner } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import { DashboardMetrics1790035200000 } from "./1790035200000-dashboard-metrics";

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

describe("DashboardMetrics1790035200000", () => {
  it("backfills terminal timestamps and installs reporting invariants", async () => {
    const { queries, queryRunner } = runner();
    await new DashboardMetrics1790035200000().up(queryRunner);
    const sql = queries.join("\n");

    expect(sql).toContain(`"delivered_at" = CASE WHEN "status" = 'delivered'`);
    expect(sql).toContain(`"cancelled_at" = CASE WHEN "status" = 'cancelled'`);
    expect(sql).toContain("ck_orders_terminal_timestamps");
    expect(sql).toContain("invalid order status transition");
    expect(sql).toContain("delivered order terminal state is immutable");
    expect(sql).toContain("idx_orders_delivered_at");
  });

  it("removes only the additive Phase 13 schema during rollback", async () => {
    const { queries, queryRunner } = runner();
    await new DashboardMetrics1790035200000().down(queryRunner);
    const sql = queries.join("\n");

    expect(sql).toContain(`DROP TRIGGER IF EXISTS "trg_orders_terminal_timestamps"`);
    expect(sql).toContain(`DROP COLUMN "cancelled_at"`);
    expect(sql).toContain(`DROP COLUMN "delivered_at"`);
    expect(sql).not.toContain(`DROP TABLE "orders"`);
  });
});
