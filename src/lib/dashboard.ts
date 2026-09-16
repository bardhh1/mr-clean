import { apiRequest } from "@/lib/api";
import type { OrderStatus } from "@/lib/types";

export type DashboardRange = "7d" | "30d" | "90d" | "12m";
export type SalesInterval = "day" | "week" | "month";

export type ReportingPeriod = {
  from: string;
  to: string;
  timezone: string;
};

export type DashboardSummary = {
  period: ReportingPeriod;
  revenue_cents: number;
  delivered_order_count: number;
  average_order_value_cents: number;
  orders_created: number;
  orders_by_status: Record<OrderStatus, number>;
};

export type SalesPoint = {
  bucket_start: string;
  order_count: number;
  revenue_cents: number;
};

export type SalesResponse = {
  period: ReportingPeriod;
  interval: SalesInterval;
  data: SalesPoint[];
};

export type TopProduct = {
  product_id: string | null;
  name: string;
  unit: string;
  units_sold: number;
  revenue_cents: number;
  order_count: number;
};

export type TopProductsResponse = {
  period: ReportingPeriod;
  sort: "revenue" | "quantity";
  data: TopProduct[];
};

export type ActivityItem = {
  id: string;
  kind: "order.created" | "audit";
  action: string;
  outcome: "success" | "failure" | null;
  target_type: string | null;
  target_id: string | null;
  occurred_at: string;
  details: Record<string, unknown>;
};

export type AuditEvent = {
  id: string;
  action: string;
  outcome: "success" | "failure";
  actor_admin_user_id: string | null;
  session_id: string | null;
  target_type: string | null;
  target_id: string | null;
  request_id: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
};

export type AuditResponse = {
  period: ReportingPeriod;
  data: AuditEvent[];
  meta: {
    limit: number;
    has_more: boolean;
    next_cursor: string | null;
  };
};

export function getDashboardSummary(range: DashboardRange) {
  return apiRequest<DashboardSummary>(`/admin/dashboard/summary?range=${range}`);
}

export function getDashboardSales(range: DashboardRange, interval: SalesInterval) {
  return apiRequest<SalesResponse>(
    `/admin/dashboard/sales?range=${range}&interval=${interval}`
  );
}

export function getTopProducts(range: DashboardRange) {
  return apiRequest<TopProductsResponse>(
    `/admin/dashboard/top-products?range=${range}&sort=revenue&limit=8`
  );
}

export function getDashboardActivity(limit = 12) {
  return apiRequest<{ data: ActivityItem[] }>(`/admin/dashboard/activity?limit=${limit}`);
}

export function getAuditEvents(options: {
  range?: DashboardRange;
  action?: string;
  outcome?: "success" | "failure" | "";
  targetType?: string;
  cursor?: string | null;
  limit?: number;
} = {}) {
  const params = new URLSearchParams({
    range: options.range ?? "30d",
    limit: String(options.limit ?? 25)
  });
  if (options.action) params.set("action", options.action);
  if (options.outcome) params.set("outcome", options.outcome);
  if (options.targetType) params.set("target_type", options.targetType);
  if (options.cursor) params.set("cursor", options.cursor);
  return apiRequest<AuditResponse>(`/admin/audit-events?${params.toString()}`);
}
