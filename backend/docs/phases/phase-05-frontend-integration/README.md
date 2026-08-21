# Phase 05 — Vercel frontend and NestJS API integration

## Outcome

This phase makes the React storefront and admin panel clients of the NestJS API. Production catalog reads, checkout writes, authentication, category/product management, product-image uploads, and order status updates now cross one typed HTTP boundary. The browser no longer connects directly to Supabase database, authentication, or storage services.

The accepted storefront still renders demo catalog data only when `VITE_API_BASE_URL` is intentionally absent. Once that variable exists, API failures are shown to the user rather than silently substituting stale demo IDs or prices.

## Shared API client

`src/lib/api.ts` centralizes browser transport:

- Normalized `VITE_API_BASE_URL` handling.
- JSON and multipart request bodies.
- `credentials: include` for `HttpOnly` admin cookies.
- The stable trusted-client header expected by the API.
- Parsing of normalized NestJS errors and request IDs.
- One automatic access-token recovery attempt through refresh rotation.
- A shared in-flight refresh promise, preventing multiple parallel admin requests from rotating the same refresh session concurrently.

This removes duplicated fetch behavior and ensures that every feature observes the same cookie, error, and retry contract.

## Catalog behavior

Public category and product loaders now use:

- `GET /api/v1/categories`
- `GET /api/v1/products?limit=100`
- `GET /api/v1/products/:slug`

Requests are deduplicated in memory and cached for ten minutes, shorter than the API's 15-minute private-image signatures. A failure clears the cached promise so a later navigation can recover. Admin catalog mutations invalidate both public caches immediately.

Product detail starts its product and related-product requests together. Related products are non-critical: a related-list failure does not hide a successfully loaded product. Actual product failures now leave loading state and render an actionable error instead of an indefinite skeleton.

## Cart persistence and image freshness

The local cart moved to a versioned `mr-clean-cart:v2` schema. Stored values are structurally checked before use, quantities are capped to the API's 999-unit limit, and corrupted data is discarded safely.

On application startup, a configured frontend refreshes saved product snapshots from the API. This replaces expiring Railway signed-image URLs, updates names and prices, and removes products that are no longer publicly orderable. It also prevents cart IDs from the old demo deployment from reaching the production order endpoint.

## Idempotent checkout

Checkout sends customer fields and product ID/quantity pairs to `POST /api/v1/orders`. It never sends authoritative prices or totals.

The browser stores one UUID and normalized attempt signature in `sessionStorage`:

- Retrying the same form and cart reuses the UUID, including after a page reload.
- Changing form data or cart quantities creates a new key.
- A successful API response clears the saved attempt.

The WhatsApp handoff uses the API's customer-facing reference and server-confirmed total. The cart is cleared only after PostgreSQL confirms the order.

## Admin authentication and management

The admin panel now uses the NestJS session routes. Short-lived access recovery is transparent to the page; an expired or invalid refresh session returns the interface to unauthenticated behavior.

Admin data loads in parallel:

- All active and inactive categories.
- All active and inactive products.
- The newest 100 orders.

Category/product forms use protected CRUD endpoints. Railway Bucket uploads return a private object key and temporary preview URL; product records persist the key rather than the expiring URL. Visibility changes invalidate the public catalog cache.

The order list can move `pending_whatsapp` orders to `confirmed` and confirmed orders to `completed`, using the backend's concurrency-safe transition endpoint.

## Environment contract

The frontend now requires only:

```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_WHATSAPP_PHONE=38344123456
VITE_SITE_URL=http://localhost:5173
```

Vite embeds variables at build time. Phase 06 sets the Railway API URL in Vercel before building the production deployment.

## React production review

The integration was checked against the project's React production guidance:

- Independent catalog and admin requests start in parallel.
- API and refresh requests are deduplicated rather than forming avoidable waterfalls.
- Route-level lazy loading remains intact; the admin code stays in its own chunk.
- Transient idempotency state lives outside render and survives navigation safely.
- Effects use cancellation guards before committing asynchronous state.
- Derived cart totals and counts remain memoized with their item dependency.
- Conditional UI uses explicit ternaries for empty, loading, error, and authenticated states.

## Verification performed

From the repository root:

```bash
npm run lint
npm run build
```

From `backend/`:

```bash
npm run lint
npm run test
npm run build
```

The frontend production build preserves route-based chunks and completes without TypeScript or ESLint errors. Cross-origin catalog, checkout, session refresh, upload, and admin workflows are verified against the deployed Railway service in Phase 06.

## Why this matters

The UI is no longer a second business-logic layer. Prices, permissions, session validity, storage access, and order transitions all belong to the API. Vercel serves a fast static client while Railway owns stateful compute and data, allowing either side to deploy independently behind a stable versioned contract.

## What this enables next

Phase 06 provisions the Railway project, PostgreSQL database, and private bucket; applies migrations; configures production cookies and CORS; gives the API a public domain; injects that domain into Vercel; and verifies the complete browser-to-database flow.
