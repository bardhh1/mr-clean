# Phase 13 — Dashboard metrics and activity APIs

## Outcome

Phase 13 adds the protected analytics contract used by the Phase 14 administrator dashboard without depending on inventory data.

- Revenue and average order value include delivered cash-on-delivery orders only.
- Order counts include orders created in the selected period and group them by current status.
- Sales are zero-filled by day, week, or month in the `Europe/Belgrade` business timezone.
- Top products use immutable order-item snapshots and delivered orders only.
- Recent activity combines new-order events with the append-only administrator audit ledger.
- Audit history supports bounded filters and stable keyset cursor pagination.
- No low-stock or out-of-stock fields are exposed before Phase 12.

All monetary values remain integer EUR cents.

## Terminal timestamps

Migration `1790035200000-dashboard-metrics.ts` adds nullable `delivered_at` and `cancelled_at` columns to `orders`. Existing terminal orders are backfilled from `updated_at`.

PostgreSQL enforces the lifecycle and timestamp invariants:

- A delivered order has exactly one `delivered_at` value.
- A cancelled order has exactly one `cancelled_at` value.
- Non-terminal orders have neither timestamp.
- Terminal statuses and their timestamps are immutable.
- Status changes must follow the Phase 11 transition graph.

The database trigger assigns a terminal timestamp when an order first enters `delivered` or `cancelled`. The application also sets it in the same status-change transaction so the administrative response contains the committed business time. Reporting indexes cover delivered sales and created-order status queries.

## Protected API

Every endpoint requires the existing trusted-client header and authenticated MFA-backed administrator session. Browser requests also pass through the existing Origin and CSRF policy. Responses send `Cache-Control: no-store`, and each endpoint has a dedicated limit of 30 requests per minute.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/admin/dashboard/summary` | Delivered revenue, delivered-order count, AOV, created-order total, and current status counts |
| `GET /api/v1/admin/dashboard/sales` | Zero-filled delivered revenue and order-count buckets |
| `GET /api/v1/admin/dashboard/top-products` | Delivered product revenue, units, and order count |
| `GET /api/v1/admin/dashboard/activity` | Recent order references and administrator actions without customer details |
| `GET /api/v1/admin/audit-events` | Filterable append-only audit history with cursor pagination |

Dashboard reads deliberately do not create audit records. This prevents recursive noise in activity and audit history.

## Reporting periods

The default preset is `30d`. The accepted presets are `7d`, `30d`, `90d`, and `12m`.

Custom periods require both `from` and `to` in `YYYY-MM-DD` form. Dates are inclusive at the API boundary and become an inclusive start and exclusive next-day end in PostgreSQL. Custom periods cannot exceed five years. Daily sales buckets cannot exceed 366 days; use weekly or monthly buckets for longer ranges.

Examples:

```text
?range=7d
?from=2026-09-01&to=2026-09-15
```

Sales accepts `interval=day|week|month`. It defaults to `month` for `12m` and `day` otherwise. PostgreSQL groups `delivered_at AT TIME ZONE 'Europe/Belgrade'`, so local midnight and daylight-saving transitions do not shift sales into an adjacent business day.

## Top products

Top products default to `sort=revenue`, accept `sort=quantity`, and permit `limit=1..50`.

Retained products group by product ID and display their current name and unit. If a product has been deleted, reporting falls back to its immutable order-item name and unit snapshots. Deterministic tie-breaking uses revenue, quantity, name, and product ID.

## Audit history

Audit history accepts these bounded filters:

- `action`
- `outcome=success|failure`
- `target_type`
- `target_id`
- reporting preset or custom dates
- `limit=1..100`
- the opaque `cursor` returned as `meta.next_cursor`

The response exposes the existing safe ledger fields: action, outcome, target, timestamp, administrator/session/request context, pseudonymous IP hash, user agent, and sanitized metadata. Clients must treat the cursor as opaque and must not construct or modify it.

## Verification

Before push:

```bash
npm run lint
npm run build
npm run test:security-headers

cd backend
npm run lint
npm run test:coverage
npm run build
npm run test:e2e
```

End-to-end tests must run against a fresh PostgreSQL database after every migration. They verify protected access, terminal lifecycle behavior, delivered-only metrics, zero-filled series, top-product aggregation, safe activity, audit filtering and pagination, query validation, and `no-store` responses.

## Rollout

No new environment variables or checkout maintenance window are required.

1. Verify a current PostgreSQL backup.
2. Deploy the additive migration before the Phase 14 frontend.
3. Confirm the new migration appears in the migration table.
4. Compare the summary delivered count and revenue with aggregate database queries that print no customer information.
5. Confirm status counts sum to the API's `orders_created` value.
6. Reconcile top-product revenue and units with delivered order items.
7. Fetch multiple audit pages and confirm there are no skipped or duplicated event IDs.

Example aggregate checks should return counts and cents only; do not select customer names, addresses, phone numbers, or email addresses into deployment logs.

If application code must be rolled back, retain the additive columns, trigger, constraint, and indexes. Do not run the down migration merely to roll back the API. A forward fix is preferred once production has written terminal timestamps.

## Sequencing

After production verification:

1. Build Phase 14 against these APIs.
2. Complete the client administrator handoff while the client is present.
3. Implement Phase 12 on-site from verified opening stock quantities.
4. Add inventory cards and screens to the dashboard as the final integration pass.
