# Phase 04 — Transactional orders and fulfillment workflow

## Outcome

This phase turns checkout into a durable server-side transaction. A customer submits contact and delivery details plus product IDs and quantities. The API locks and reads the current products from PostgreSQL, calculates every amount itself, writes the order and immutable line snapshots atomically, and returns a compact receipt for the WhatsApp handoff.

Administrators can search orders, inspect their original line items, and move each order through a constrained fulfillment lifecycle. Customer personally identifiable information is never exposed through a public read endpoint.

## Database model

### Orders

`orders` stores:

- UUID primary key and a shorter unique `MC-...` business reference.
- A unique client-generated idempotency UUID and SHA-256 request fingerprint.
- Customer, company, phone, city, address, notes, and payment preference.
- Status, integer-cent total, fixed EUR currency, and audit timestamps.

Database checks constrain the request hash, payment preference, supported statuses, non-negative total, and currency. Indexes cover newest-first administration, status queues, and partial-text searches by reference, customer, company, or phone.

### Order items

`order_items` stores both an optional live product reference and immutable commercial snapshots:

- Product name and unit at purchase time.
- Quantity and unit price in integer cents.
- Calculated line total.
- Original cart position.

The database checks quantity bounds, non-negative price, and the equation `line_total_cents = unit_price_cents * quantity`. Deleting a product sets the live reference to `NULL` but preserves the order history. Deleting an order cascades to its items.

These snapshots matter because catalog names, units, and prices can change after a customer submits an order. Historical orders must continue to describe what the customer actually requested.

## Public checkout endpoint

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/orders` | Create or safely replay one checkout. |

The request contains a UUID `idempotency_key`, validated customer fields, payment preference, and 1–50 unique product lines with quantities from 1–999. Unknown fields, duplicate product IDs, malformed phones, invalid UUIDs, and overlong values are rejected before database work begins.

The route has a tighter 10-request-per-five-minute throttle. It deliberately has no corresponding public `GET` endpoint: knowing an order UUID must not reveal customer data.

## Server-authoritative transaction

Creation performs the following work inside one PostgreSQL transaction:

1. Load all requested products by ID with a pessimistic read lock.
2. Reject missing, inactive, or quote-only products.
3. Use current database prices; no price or total from the browser is accepted.
4. Verify the resulting total remains a safe integer.
5. Insert the order and all item snapshots.
6. Commit only when every write succeeds.

If any step fails, no partial order or orphan line survives. This is essential for operations: a visible order always has a complete, internally consistent ledger.

## Idempotency and retries

The frontend generates one UUID for a checkout attempt. The API normalizes the request and stores a SHA-256 fingerprint alongside the unique key.

- Repeating the same key with the same normalized order returns the original receipt without inserting again.
- Reusing that key with different data returns `409 Conflict`.
- Concurrent duplicate submissions are resolved through the database unique constraint; the losing request reads and returns the committed winner.

This protects against double clicks, mobile network retries, browser navigation, and uncertain client timeouts. Idempotency is enforced by PostgreSQL, not an in-memory cache, so it works across Railway replicas and restarts.

## Public receipt

The public response only includes:

- Internal ID and customer-facing reference.
- Current status.
- Server-calculated total and currency.
- Creation time.

It does not echo the address, phone, notes, request fingerprint, or idempotency key. The frontend uses the reference in its WhatsApp message while the admin API retains the full record.

## Admin order endpoints

All routes require an active admin session and trusted-client header.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/orders` | Search, filter by status, and paginate newest-first orders. |
| `GET` | `/api/v1/admin/orders/:id` | Read one order and its ordered item snapshots. |
| `PATCH` | `/api/v1/admin/orders/:id/status` | Apply one valid fulfillment transition. |

The list accepts `status`, `search`, `limit`, and `offset` and returns pagination metadata. The API omits internal request hashes and idempotency keys from admin responses as well.

## Fulfillment state machine

Allowed transitions are intentionally small:

```text
pending_whatsapp -> confirmed -> completed
        |              |
        +-> cancelled <-+
```

`completed` and `cancelled` are terminal. Repeating the current status is idempotent; skipping or reversing a state returns `409 Conflict`. Status updates acquire a pessimistic write lock, so two administrators cannot validate transitions against the same stale status.

## Verification performed

Run from `backend/`:

```bash
npm run lint
npm run test
npm run build
```

The order tests prove that:

- PostgreSQL product prices determine totals and line snapshots.
- Identical idempotent retries return the first receipt without a second transaction.
- Reusing a key with a changed cart is rejected.
- Inactive and quote-only items cannot enter direct checkout.

The migration and live transaction are exercised against Railway PostgreSQL during Phase 06.

## Why this matters

Checkout is the highest-integrity public workflow in the project. This phase makes an order a complete business record rather than a best-effort collection of browser writes. It is safe under retries, independent of catalog changes, private by default, and useful to fulfillment staff immediately after submission.

## What this enables next

Phase 05 replaces the frontend's Supabase and demo write paths with this NestJS contract. Checkout will generate idempotency keys, render API errors, use the business reference in WhatsApp, and let the admin screen manage the same PostgreSQL order records.
