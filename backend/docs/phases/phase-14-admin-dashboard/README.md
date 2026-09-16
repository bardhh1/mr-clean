# Phase 14 — Administrator operations dashboard

## Outcome

Phase 14 replaces the basic administrator page with a responsive, protected operations workspace. It uses the existing MFA-backed administrator session, Phase 10 browser protections, Phase 11 order workflow, and Phase 13 analytics APIs.

The dashboard provides:

- delivered revenue, delivered order count, average order value, and created-order totals;
- zero-filled sales charts for 7 days, 30 days, 90 days, and 12 months;
- current order-status counts and revenue-ranked products;
- order search, filtering, advancement, and cancellation;
- category creation, product creation, image upload, and public visibility controls;
- recent operational activity and cursor-paginated audit history;
- active administrator sessions, logout, logout-all, and recovery-code regeneration.

Inventory values are intentionally absent until Phase 12. The interface states this explicitly and never substitutes catalog labels or misleading zeroes for stock quantities.

## Security boundary

The frontend does not create a parallel authentication mechanism. All administrator reads and writes continue through the same API client with:

- `credentials: include` for HttpOnly session cookies;
- the trusted-client header;
- the synchronizer CSRF header for unsafe methods;
- automatic access-token refresh with a single retry;
- MFA-backed server authorization;
- API responses marked `Cache-Control: no-store` by the backend.

Dashboard data is held only in component memory. Passwords, TOTP codes, MFA bootstrap tokens, recovery codes, session identifiers, audit cursors, and API responses are not persisted to local storage.

Recovery codes retain the Phase 09 one-time display gate. Logout-all revokes all server sessions and then clears the local authenticated view. Destructive order cancellation and global logout require explicit operator confirmation.

## Reporting semantics

The interface preserves the Phase 13 definitions:

- revenue and average order value include delivered cash-on-delivery orders only;
- status counts describe orders created during the selected period and their current status;
- sales use the `Europe/Belgrade` reporting timezone;
- 7-day and 30-day views use daily buckets, 90-day views use weekly buckets, and 12-month views use monthly buckets;
- top products use immutable delivered order-item snapshots with the current retained product name when available.

All monetary values received from the API remain integer EUR cents until formatted for display.

## Accessibility and responsive behavior

The operations navigation uses native buttons, visible focus styles, current-page semantics, and Lucide icons with text labels. It becomes a horizontally scrollable navigation strip on smaller screens and a sticky sidebar on desktop.

The sales visualization has an accessible SVG title and description. Exact chart values remain available in a keyboard-operable table. Tables use explicit headers, forms retain labels and validation messages, status changes are announced, and interactive controls meet the existing 44-pixel target size.

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
```

Browser verification must cover the unauthenticated login screen at desktop and mobile sizes. An authenticated production verification must additionally cover:

1. password plus TOTP login;
2. each reporting preset and its chart/table output;
3. order search, filtering, and a permitted lifecycle transition;
4. catalog creation and product visibility changes;
5. audit filtering and loading another cursor page;
6. session listing, ordinary logout, and a fresh login;
7. logout-all followed by confirmation that every previous session is rejected;
8. recovery-code regeneration and its one-time acknowledgement gate.

Do not perform a real order transition, catalog mutation, recovery-code rotation, or logout-all in production merely as a smoke test. Use an intended business change or a prepared test record and obtain the administrator's confirmation for security-sensitive account actions.

## Rollout

Phase 14 is a frontend-only deployment and adds no environment variables or database migrations.

1. Confirm the deployed Phase 13 endpoints are healthy.
2. Deploy the frontend through Vercel.
3. Check the `/admin` login screen, security headers, and mobile layout without authenticating.
4. Complete the authenticated verification checklist with the administrator present.
5. Reconcile Phase 13 production aggregates before treating dashboard figures as production-verified.

If the interface must be rolled back, redeploy the preceding Vercel build. The Phase 13 additive database fields and APIs remain in place.

## Deferred inventory integration

After the client supplies verified opening stock quantities on site, Phase 12 will add the stock movement ledger, atomic reservations, cancellation releases, fulfillment deductions, low-stock thresholds, and adjustment history. The final integration pass will then add inventory cards and operational screens to this dashboard.
