import { BadRequestException, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import type {
  ActivityQueryDto,
  AuditEventsQueryDto,
  ReportingPeriodDto,
  ReportingRange,
  SalesQueryDto,
  TopProductsQueryDto
} from "./dto/dashboard-query.dto";

const reportingTimeZone = "Europe/Belgrade";
const maxCustomDays = 1_831;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Period = {
  from: string;
  to: string;
  timezone: typeof reportingTimeZone;
  days: number;
};

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async summary(query: ReportingPeriodDto) {
    const period = resolvePeriod(query);
    const [row] = await this.dataSource.query<Array<Record<string, string>>>(`
      WITH bounds AS (
        SELECT
          $1::date::timestamp AT TIME ZONE $3 AS start_at,
          ($2::date + 1)::timestamp AT TIME ZONE $3 AS end_at
      )
      SELECT
        count(*) FILTER (
          WHERE "created_at" >= bounds.start_at AND "created_at" < bounds.end_at
        )::bigint AS "orders_created",
        count(*) FILTER (
          WHERE "created_at" >= bounds.start_at AND "created_at" < bounds.end_at
            AND "status" = 'pending'
        )::bigint AS "pending",
        count(*) FILTER (
          WHERE "created_at" >= bounds.start_at AND "created_at" < bounds.end_at
            AND "status" = 'confirmed'
        )::bigint AS "confirmed",
        count(*) FILTER (
          WHERE "created_at" >= bounds.start_at AND "created_at" < bounds.end_at
            AND "status" = 'processing'
        )::bigint AS "processing",
        count(*) FILTER (
          WHERE "created_at" >= bounds.start_at AND "created_at" < bounds.end_at
            AND "status" = 'shipped'
        )::bigint AS "shipped",
        count(*) FILTER (
          WHERE "created_at" >= bounds.start_at AND "created_at" < bounds.end_at
            AND "status" = 'delivered'
        )::bigint AS "delivered",
        count(*) FILTER (
          WHERE "created_at" >= bounds.start_at AND "created_at" < bounds.end_at
            AND "status" = 'cancelled'
        )::bigint AS "cancelled",
        count(*) FILTER (
          WHERE "delivered_at" >= bounds.start_at AND "delivered_at" < bounds.end_at
        )::bigint AS "delivered_sales_count",
        COALESCE(sum("total_cents") FILTER (
          WHERE "delivered_at" >= bounds.start_at AND "delivered_at" < bounds.end_at
        ), 0)::bigint AS "revenue_cents"
      FROM "orders"
      CROSS JOIN bounds
    `, [period.from, period.to, period.timezone]);

    const deliveredSalesCount = toSafeInteger(row?.delivered_sales_count, "delivered sales count");
    const revenueCents = toSafeInteger(row?.revenue_cents, "revenue");
    return {
      period: publicPeriod(period),
      revenue_cents: revenueCents,
      delivered_order_count: deliveredSalesCount,
      average_order_value_cents: deliveredSalesCount === 0
        ? 0
        : Math.round(revenueCents / deliveredSalesCount),
      orders_created: toSafeInteger(row?.orders_created, "created order count"),
      orders_by_status: {
        pending: toSafeInteger(row?.pending, "pending order count"),
        confirmed: toSafeInteger(row?.confirmed, "confirmed order count"),
        processing: toSafeInteger(row?.processing, "processing order count"),
        shipped: toSafeInteger(row?.shipped, "shipped order count"),
        delivered: toSafeInteger(row?.delivered, "delivered order count"),
        cancelled: toSafeInteger(row?.cancelled, "cancelled order count")
      }
    };
  }

  async sales(query: SalesQueryDto) {
    const period = resolvePeriod(query);
    const interval = query.interval ?? (query.range === "12m" ? "month" : "day");
    if (interval === "day" && period.days > 366) {
      throw new BadRequestException("Daily sales are limited to 366 days");
    }
    const step = interval === "day" ? "1 day" : interval === "week" ? "1 week" : "1 month";
    const rows = await this.dataSource.query<Array<{
      bucket_start: string;
      order_count: string;
      revenue_cents: string;
    }>>(`
      WITH bounds AS (
        SELECT
          $1::date::timestamp AS local_from,
          $2::date::timestamp AS local_to,
          $1::date::timestamp AT TIME ZONE $3 AS start_at,
          ($2::date + 1)::timestamp AT TIME ZONE $3 AS end_at
      ), buckets AS (
        SELECT generate_series(
          date_trunc('${interval}', bounds.local_from),
          date_trunc('${interval}', bounds.local_to),
          interval '${step}'
        ) AS bucket_start
        FROM bounds
      ), delivered AS (
        SELECT
          date_trunc('${interval}', "delivered_at" AT TIME ZONE $3) AS bucket_start,
          count(*)::bigint AS order_count,
          sum("total_cents")::bigint AS revenue_cents
        FROM "orders"
        CROSS JOIN bounds
        WHERE "delivered_at" >= bounds.start_at
          AND "delivered_at" < bounds.end_at
        GROUP BY 1
      )
      SELECT
        to_char(buckets.bucket_start, 'YYYY-MM-DD') AS bucket_start,
        COALESCE(delivered.order_count, 0)::bigint AS order_count,
        COALESCE(delivered.revenue_cents, 0)::bigint AS revenue_cents
      FROM buckets
      LEFT JOIN delivered USING (bucket_start)
      ORDER BY buckets.bucket_start ASC
    `, [period.from, period.to, period.timezone]);

    return {
      period: publicPeriod(period),
      interval,
      data: rows.map((row) => ({
        bucket_start: row.bucket_start,
        order_count: toSafeInteger(row.order_count, "sales bucket order count"),
        revenue_cents: toSafeInteger(row.revenue_cents, "sales bucket revenue")
      }))
    };
  }

  async topProducts(query: TopProductsQueryDto) {
    const period = resolvePeriod(query);
    const orderBy = query.sort === "quantity"
      ? `"units_sold" DESC, "revenue_cents" DESC`
      : `"revenue_cents" DESC, "units_sold" DESC`;
    const rows = await this.dataSource.query<Array<{
      product_id: string | null;
      name: string;
      unit: string;
      units_sold: string;
      revenue_cents: string;
      order_count: string;
    }>>(`
      WITH bounds AS (
        SELECT
          $1::date::timestamp AT TIME ZONE $3 AS start_at,
          ($2::date + 1)::timestamp AT TIME ZONE $3 AS end_at
      )
      SELECT
        item."product_id",
        COALESCE(product."name", item."name_snapshot") AS "name",
        COALESCE(product."unit", item."unit_snapshot") AS "unit",
        sum(item."quantity")::bigint AS "units_sold",
        sum(item."line_total_cents")::bigint AS "revenue_cents",
        count(DISTINCT item."order_id")::bigint AS "order_count"
      FROM "order_items" item
      INNER JOIN "orders" purchase ON purchase."id" = item."order_id"
      LEFT JOIN "products" product ON product."id" = item."product_id"
      CROSS JOIN bounds
      WHERE purchase."delivered_at" >= bounds.start_at
        AND purchase."delivered_at" < bounds.end_at
      GROUP BY
        item."product_id",
        COALESCE(product."name", item."name_snapshot"),
        COALESCE(product."unit", item."unit_snapshot")
      ORDER BY ${orderBy}, "name" ASC, item."product_id" ASC NULLS LAST
      LIMIT $4
    `, [period.from, period.to, period.timezone, query.limit]);

    return {
      period: publicPeriod(period),
      sort: query.sort,
      data: rows.map((row) => ({
        product_id: row.product_id,
        name: row.name,
        unit: row.unit,
        units_sold: toSafeInteger(row.units_sold, "top product units"),
        revenue_cents: toSafeInteger(row.revenue_cents, "top product revenue"),
        order_count: toSafeInteger(row.order_count, "top product order count")
      }))
    };
  }

  async activity(query: ActivityQueryDto) {
    const rows = await this.dataSource.query<Array<{
      id: string;
      kind: "order.created" | "audit";
      action: string;
      outcome: "success" | "failure";
      target_type: string;
      target_id: string;
      occurred_at: Date;
      details: Record<string, unknown>;
    }>>(`
      SELECT * FROM (
        SELECT
          "id",
          'order.created'::text AS "kind",
          'orders.created'::text AS "action",
          'success'::text AS "outcome",
          'order'::text AS "target_type",
          "id"::text AS "target_id",
          "created_at" AS "occurred_at",
          jsonb_build_object('reference', "reference", 'status', "status") AS "details"
        FROM "orders"
        UNION ALL
        SELECT
          "id",
          'audit'::text AS "kind",
          "action",
          "outcome",
          COALESCE("target_type", 'event') AS "target_type",
          COALESCE("target_id", "id"::text) AS "target_id",
          "occurred_at",
          "metadata" AS "details"
        FROM "admin_audit_events"
      ) activity
      ORDER BY "occurred_at" DESC, "id" DESC
      LIMIT $1
    `, [query.limit]);

    return {
      data: rows.map((row) => ({ ...row, occurred_at: isoDate(row.occurred_at) }))
    };
  }

  async auditEvents(query: AuditEventsQueryDto) {
    const period = resolvePeriod(query);
    const values: unknown[] = [period.from, period.to, period.timezone];
    const where = [
      `"occurred_at" >= $1::date::timestamp AT TIME ZONE $3`,
      `"occurred_at" < ($2::date + 1)::timestamp AT TIME ZONE $3`
    ];
    const add = (clause: string, value: unknown) => {
      values.push(value);
      where.push(clause.replace("?", `$${values.length}`));
    };
    if (query.action) add(`"action" = ?`, query.action);
    if (query.outcome) add(`"outcome" = ?`, query.outcome);
    if (query.target_type) add(`"target_type" = ?`, query.target_type);
    if (query.target_id) add(`"target_id" = ?`, query.target_id);
    if (query.cursor) {
      const cursor = decodeAuditCursor(query.cursor);
      values.push(cursor.occurred_at, cursor.id);
      where.push(`("occurred_at", "id") < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
    }
    values.push(query.limit + 1);

    const rows = await this.dataSource.query<Array<{
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
      occurred_at: Date;
    }>>(`
      SELECT
        "id", "action", "outcome", "actor_admin_user_id", "session_id",
        "target_type", "target_id", "request_id", "ip_hash", "user_agent",
        "metadata", "occurred_at"
      FROM "admin_audit_events"
      WHERE ${where.join(" AND ")}
      ORDER BY "occurred_at" DESC, "id" DESC
      LIMIT $${values.length}
    `, values);

    const hasMore = rows.length > query.limit;
    const data = rows.slice(0, query.limit).map((row) => ({
      ...row,
      occurred_at: isoDate(row.occurred_at)
    }));
    const last = data.at(-1);
    return {
      period: publicPeriod(period),
      data,
      meta: {
        limit: query.limit,
        has_more: hasMore,
        next_cursor: hasMore && last
          ? encodeAuditCursor(last.occurred_at, last.id)
          : null
      }
    };
  }
}

export function resolvePeriod(query: ReportingPeriodDto, now = new Date()): Period {
  if (Boolean(query.from) !== Boolean(query.to)) {
    throw new BadRequestException("Custom reporting periods require both from and to dates");
  }
  if (query.from && query.to) {
    const from = parseCalendarDate(query.from);
    const to = parseCalendarDate(query.to);
    const days = inclusiveDays(from, to);
    if (days < 1) throw new BadRequestException("Reporting from date must not follow to date");
    if (days > maxCustomDays) {
      throw new BadRequestException("Custom reporting periods are limited to five years");
    }
    return { from: formatCalendarDate(from), to: formatCalendarDate(to), timezone: reportingTimeZone, days };
  }

  const to = currentDateInTimeZone(now, reportingTimeZone);
  const range = query.range ?? "30d";
  const from = startForRange(to, range);
  return {
    from: formatCalendarDate(from),
    to: formatCalendarDate(to),
    timezone: reportingTimeZone,
    days: inclusiveDays(from, to)
  };
}

function startForRange(to: Date, range: ReportingRange): Date {
  if (range !== "12m") {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    return addUtcDays(to, -(days - 1));
  }
  const priorYearDay = Math.min(
    to.getUTCDate(),
    daysInMonth(to.getUTCFullYear() - 1, to.getUTCMonth())
  );
  return addUtcDays(new Date(Date.UTC(
    to.getUTCFullYear() - 1,
    to.getUTCMonth(),
    priorYearDay
  )), 1);
}

function currentDateInTimeZone(now: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);
  return new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
}

function parseCalendarDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (formatCalendarDate(parsed) !== value) {
    throw new BadRequestException("Reporting dates must be valid calendar dates");
  }
  return parsed;
}

function formatCalendarDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addUtcDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 86_400_000);
}

function inclusiveDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function publicPeriod(period: Period) {
  return { from: period.from, to: period.to, timezone: period.timezone };
}

function toSafeInteger(value: string | number | undefined, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${label} is outside the supported range`);
  }
  return parsed;
}

function isoDate(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("Database returned an invalid timestamp");
  return parsed.toISOString();
}

function encodeAuditCursor(occurredAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ occurred_at: occurredAt, id })).toString("base64url");
}

function decodeAuditCursor(value: string): { occurred_at: string; id: string } {
  try {
    const decoded = Buffer.from(value, "base64url");
    if (decoded.toString("base64url") !== value) throw new Error("non-canonical cursor");
    const parsed = JSON.parse(decoded.toString("utf8")) as Record<string, unknown>;
    if (
      typeof parsed.occurred_at !== "string"
      || !Number.isFinite(Date.parse(parsed.occurred_at))
      || typeof parsed.id !== "string"
      || !uuidPattern.test(parsed.id)
    ) {
      throw new Error("invalid cursor payload");
    }
    return { occurred_at: new Date(parsed.occurred_at).toISOString(), id: parsed.id };
  } catch {
    throw new BadRequestException("Audit cursor is invalid");
  }
}
