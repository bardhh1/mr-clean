import { BadRequestException } from "@nestjs/common";
import type { DataSource } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import { DashboardService, resolvePeriod } from "./dashboard.service";

function serviceWith(...responses: unknown[]) {
  const query = vi.fn();
  for (const response of responses) query.mockResolvedValueOnce(response);
  return {
    service: new DashboardService({ query } as unknown as DataSource),
    query
  };
}

describe("DashboardService", () => {
  it("resolves preset and custom reporting dates in the business timezone", () => {
    expect(resolvePeriod({ range: "30d" }, new Date("2026-09-15T10:00:00Z")))
      .toEqual({ from: "2026-08-17", to: "2026-09-15", timezone: "Europe/Belgrade", days: 30 });
    expect(resolvePeriod({ from: "2024-02-28", to: "2024-03-01" }))
      .toMatchObject({ from: "2024-02-28", to: "2024-03-01", days: 3 });
  });

  it("rejects incomplete, invalid, reversed, and excessive custom periods", () => {
    expect(() => resolvePeriod({ from: "2026-01-01" })).toThrow(BadRequestException);
    expect(() => resolvePeriod({ from: "2026-02-30", to: "2026-03-01" }))
      .toThrow(BadRequestException);
    expect(() => resolvePeriod({ from: "2026-03-02", to: "2026-03-01" }))
      .toThrow(BadRequestException);
    expect(() => resolvePeriod({ from: "2020-01-01", to: "2026-01-01" }))
      .toThrow(BadRequestException);
  });

  it("returns delivered-only revenue and a rounded AOV", async () => {
    const { service, query } = serviceWith([{
      orders_created: "8",
      pending: "1",
      confirmed: "1",
      processing: "1",
      shipped: "1",
      delivered: "3",
      cancelled: "1",
      delivered_sales_count: "3",
      revenue_cents: "1000"
    }]);

    await expect(service.summary({ from: "2026-09-01", to: "2026-09-15" }))
      .resolves.toMatchObject({
        revenue_cents: 1000,
        delivered_order_count: 3,
        average_order_value_cents: 333,
        orders_created: 8,
        orders_by_status: { delivered: 3, cancelled: 1 }
      });
    expect(query.mock.calls[0]?.[0]).toContain(`WHERE "delivered_at" >= bounds.start_at`);
  });

  it("zero-fills sales buckets and defaults a 12-month view to months", async () => {
    const { service, query } = serviceWith([
      { bucket_start: "2025-10-01", order_count: "0", revenue_cents: "0" },
      { bucket_start: "2025-11-01", order_count: "2", revenue_cents: "2500" }
    ]);
    const result = await service.sales({ range: "12m" });

    expect(result.interval).toBe("month");
    expect(result.data).toEqual([
      { bucket_start: "2025-10-01", order_count: 0, revenue_cents: 0 },
      { bucket_start: "2025-11-01", order_count: 2, revenue_cents: 2500 }
    ]);
    expect(query.mock.calls[0]?.[0]).toContain("generate_series");
  });

  it("limits overly broad daily buckets", async () => {
    const { service } = serviceWith([]);
    await expect(service.sales({
      from: "2024-01-01",
      to: "2025-01-01",
      interval: "day"
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns revenue-ranked products with safe integer totals", async () => {
    const { service, query } = serviceWith([{
      product_id: null,
      name: "Produkt historik",
      unit: "copë",
      units_sold: "4",
      revenue_cents: "1200",
      order_count: "2"
    }]);
    const result = await service.topProducts({ range: "30d", sort: "revenue", limit: 10 });

    expect(result.data[0]).toEqual({
      product_id: null,
      name: "Produkt historik",
      unit: "copë",
      units_sold: 4,
      revenue_cents: 1200,
      order_count: 2
    });
    expect(query.mock.calls[0]?.[0]).toContain(`"revenue_cents" DESC, "units_sold" DESC`);
  });

  it("returns recent order and audit activity without customer fields", async () => {
    const occurredAt = new Date("2026-09-15T12:00:00Z");
    const { service } = serviceWith([{
      id: "11111111-1111-4111-8111-111111111111",
      kind: "order.created",
      action: "orders.created",
      outcome: "success",
      target_type: "order",
      target_id: "11111111-1111-4111-8111-111111111111",
      occurred_at: occurredAt,
      details: { reference: "MC-TEST" }
    }]);

    await expect(service.activity({ limit: 20 })).resolves.toEqual({ data: [
      expect.objectContaining({ occurred_at: occurredAt.toISOString(), details: { reference: "MC-TEST" } })
    ] });
  });

  it("paginates parameterized audit history with an opaque cursor", async () => {
    const rows = [1, 2].map((index) => ({
      id: `11111111-1111-4111-8111-11111111111${index}`,
      action: "orders.status_updated",
      outcome: "success" as const,
      actor_admin_user_id: null,
      session_id: null,
      target_type: "order",
      target_id: null,
      request_id: null,
      ip_hash: null,
      user_agent: null,
      metadata: {},
      occurred_at: new Date(`2026-09-1${6 - index}T12:00:00Z`)
    }));
    const first = serviceWith(rows);
    const page = await first.service.auditEvents({
      range: "30d",
      action: "orders.status_updated",
      limit: 1
    });
    expect(page.meta.has_more).toBe(true);
    expect(page.meta.next_cursor).toEqual(expect.any(String));
    expect(first.query.mock.calls[0]?.[0]).toContain(`"action" = $4`);
    expect(first.query.mock.calls[0]?.[1]).toContain("orders.status_updated");

    const second = serviceWith([]);
    await second.service.auditEvents({ range: "30d", cursor: page.meta.next_cursor!, limit: 1 });
    expect(second.query.mock.calls[0]?.[0]).toContain(`("occurred_at", "id") < ($4::timestamptz, $5::uuid)`);
    await expect(second.service.auditEvents({ range: "30d", cursor: "not-a-cursor", limit: 1 }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
