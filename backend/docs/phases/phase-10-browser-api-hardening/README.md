# Phase 10 — Browser and API hardening

## Outcome

Phase 10 moves the production browser/API boundary behind the Vercel origin and hardens every administrator mutation with multiple independent controls:

- The production frontend calls `/api/v1` on its own Vercel origin; Vercel proxies those requests to Railway.
- Administrator cookies are `Secure`, host-only, high priority, and `SameSite=Strict` in production.
- Every unsafe administrator request must present an exact allow-listed `Origin`.
- Every unsafe request made with an existing session must also present a signed, session-bound double-submit CSRF token.
- Vercel and Railway return restrictive browser security headers and Content Security Policies.
- Swagger UI and its JSON document cannot be enabled in production.
- Sensitive endpoints have route-specific rate limits in addition to the global limit.
- Authentication, catalog, product-image, and order-status events enter an append-only PostgreSQL audit ledger.

Inventory audit action names are supported by the ledger design, but inventory mutations do not exist until Phase 12. Phase 11 will replace the current order states and payment choices; Phase 10 deliberately does not change those business rules.

## Security boundary

```text
Browser
  |
  | HTTPS, same origin, /api/v1/*
  v
Vercel
  |-- static React application
  |-- browser security headers
  `-- reverse proxy for /api/v1/*
          |
          | HTTPS, preserves the browser Origin
          v
       Railway NestJS API
          |-- exact Origin validation
          |-- signed CSRF validation
          |-- MFA-backed session validation
          |-- endpoint throttling
          `-- PostgreSQL transaction + audit event
```

The Railway API remains publicly addressable for health checks and server-to-server operations, but a browser cannot perform an unsafe administrator operation directly from another origin. CORS is not treated as the security boundary: unsafe administrator controllers enforce the origin themselves.

The `x-mr-clean-client` header remains a public request-shape control. It is useful for forcing browser preflight on cross-origin requests but is not a secret and is never treated as authentication.

## Same-origin production API

`src/lib/api.ts` has two explicit modes:

- Production always uses `/api/v1` and ignores `VITE_API_BASE_URL`.
- Local development may use `VITE_API_BASE_URL`, normally `http://localhost:3000/api/v1`.

`vercel.json` places the API rewrite before the SPA fallback:

```text
/api/v1/:path* -> https://mr-clean-api-production.up.railway.app/api/v1/:path*
/(.*)          -> /index.html
```

This removes the cross-site cookie dependency that required `SameSite=None` in Phase 09. It also lets the frontend CSP restrict `connect-src` to `'self'`.

## Origin and CSRF enforcement

### Exact Origin validation

`AdminOriginGuard` permits `GET`, `HEAD`, and `OPTIONS`. For every other HTTP method, it requires an `Origin` header that exactly equals one canonical entry from `CORS_ORIGINS`.

Requests with a missing origin, a lookalike suffix, a wildcard match, a path, or any unlisted origin fail with HTTP 403. Runtime validation requires canonical HTTPS origins in production.

### Signed double-submit token

After MFA succeeds, and after every refresh rotation, the API returns three cookies:

| Cookie | JavaScript-readable | Path | Purpose |
| --- | --- | --- | --- |
| `mr_clean_access` | No | `/` | Short-lived access JWT. |
| `mr_clean_refresh` | No | `/api/v1/admin/auth` | Opaque rotating refresh credential. |
| `mr_clean_csrf` | Yes | `/` | Signed anti-CSRF token copied into `x-csrf-token`. |

All three use `Secure; SameSite=Strict; Priority=High` in production. The access and refresh cookies are `HttpOnly`; only the anti-CSRF cookie is readable by the frontend.

The anti-CSRF token contains a version, the current refresh-session UUID, an expiry, and a random 192-bit nonce. `CSRF_SECRET` authenticates the complete payload with HMAC-SHA-256. The API requires:

1. The cookie value and `x-csrf-token` value to match exactly.
2. A valid HMAC using the production secret.
3. A non-expired token.
4. A token session UUID equal to the authenticated access session, or to the refresh-cookie session for refresh/logout.

The token rotates with every refresh-session rotation. A copied token from an older session cannot authorize a new one, and a cross-site attacker cannot read the cookie value to construct the required header.

Login, MFA bootstrap, and MFA verification do not yet have a session-bound CSRF token, so they require the strict Origin check and trusted request shape. Their endpoint limits and the existing password/MFA attempt budgets remain in force.

## Browser security headers

Vercel serves the frontend with:

- CSP: self-only scripts, styles, connections, forms, and navigation-relevant defaults; no objects or frames; HTTPS upgrade.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: no-referrer`.
- A restrictive `Permissions-Policy`.
- Two-year HSTS with subdomains and preload.
- `Cross-Origin-Opener-Policy: same-origin`.
- `Cross-Origin-Resource-Policy: same-origin`.
- `X-Permitted-Cross-Domain-Policies: none`.

The Railway API uses Helmet. In production its CSP denies every default source, base URI, form action, and frame ancestor; HSTS is enabled for two years; referrers are suppressed; and cross-origin resource behavior is restricted. The API does not render production HTML.

`npm run test:security-headers` validates the Vercel header and proxy contract in CI.

## Swagger production restriction

`SWAGGER_ENABLED` controls both `/api/v1/docs` and `/api/v1/docs-json`. Production startup validation requires `SWAGGER_ENABLED=false`; a misconfigured production candidate fails before it can migrate or receive traffic.

Local and test environments may set `SWAGGER_ENABLED=true`. Swagger is therefore a development tool, not a production discovery surface.

## Endpoint-specific throttling

The existing global limit remains 120 requests per minute per Railway-normalized client address. Route limits narrow sensitive operations:

| Operation | Limit |
| --- | --- |
| Password login, MFA bootstrap, MFA verification | 5/minute each |
| Recovery-code replacement, logout-all | 3/minute each |
| Refresh, logout | 10/minute each |
| Current identity | 60/minute |
| Session list | 30/minute |
| Admin catalog list | 60/minute |
| Category/product create | 20/minute |
| Category/product update | 30/minute |
| Category/product delete | 10/minute |
| Admin order list/detail | 60/minute |
| Order status update | 30/minute |
| Product-image upload | 10 per 5 minutes |
| Product-image delete | 20 per 5 minutes |
| Public order submission | 10 per 5 minutes |

The password lockout budget, MFA challenge attempt budget, and MFA active-challenge cap remain separate controls. A rate-limit reset does not reset those account-level budgets.

## Append-only audit ledger

Migration `1788998400000-browser-api-hardening.ts` creates `admin_audit_events` with:

- Server-generated UUID and database timestamp.
- Bounded, validated action, outcome, target type, and target ID.
- Administrator and session snapshots without foreign keys, so identity/session deletion cannot erase history.
- Request ID for log correlation.
- HMAC-pseudonymized client address; raw IP addresses are not stored.
- Sanitized, bounded user agent.
- JSON-object metadata limited by a 16 KiB database check.
- Indexes for time, action/time, and target/time queries.

PostgreSQL triggers reject `UPDATE`, `DELETE`, and `TRUNCATE`. The application exposes no audit mutation path. This protects the ledger from accidental or application-level modification; it does not claim to protect against a database owner or infrastructure administrator who can alter schema or disable triggers.

Recorded actions are:

- `auth.login.failed`
- `auth.login.succeeded`
- `auth.mfa.bootstrap_authorized`
- `auth.session.refreshed`
- `auth.refresh.failed`
- `auth.refresh.reuse_detected`
- `auth.logout`
- `auth.logout_all`
- `auth.recovery_codes.regenerated`
- `catalog.category.created|updated|deleted`
- `catalog.product.created|updated|deleted`
- `catalog.product_image.upload_requested|uploaded|upload_failed`
- `catalog.product_image.delete_requested|deleted|delete_failed`
- `orders.status_updated`

Catalog mutations and order status changes write their audit event inside the same PostgreSQL transaction as the business mutation. If the audit insert fails, the business change rolls back.

Railway Bucket operations cannot participate in a PostgreSQL transaction. Before any product-image upload or delete reaches storage, the API must persist a mandatory `*_requested` event. If that insert fails, the storage mutation does not run. A successful or failed storage attempt then writes a best-effort completion event with the same operation ID. The durable request event plus the presence or absence of a completion event makes split failures detectable without claiming a distributed transaction. Delete keys are limited to the audit ledger's 128-character target-ID bound. Upload metadata stores content type and byte size, never the original client filename or file content.

Login attempts intentionally never store submitted email plaintext for an unknown identity. The normalized email is HMAC-pseudonymized with `AUDIT_HMAC_KEY`. This key must be independent from every authentication and CSRF secret.

## Runtime environment contract

In addition to all Phase 09 variables, Railway production must set:

```dotenv
NODE_ENV=production
CORS_ORIGINS=https://mr-clean-iota.vercel.app
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=strict
SWAGGER_ENABLED=false
CSRF_SECRET=<independent 32-byte Base64URL value>
AUDIT_HMAC_KEY=<different independent 32-byte Base64URL value>
```

Generate each new secret independently:

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

The canonical output is 43 unpadded Base64URL characters representing exactly 32 bytes. Runtime validation rejects malformed values and rejects reuse among the JWT secret, MFA encryption key, recovery pepper, CSRF secret, and audit HMAC key.

Do not place real secrets in source control, ordinary documentation, tickets, chat, or command output retained by CI.

## Controlled production rollout

The frontend/proxy change must land before the production cookie policy changes. This sequence avoids a period where the old cross-origin frontend receives `SameSite=Strict` cookies that its Railway requests cannot send.

1. Confirm Phase 09 production login, MFA, refresh, and logout currently work.
2. Confirm PostgreSQL contains no more than one active administrator.
3. Create and verify a production database backup or snapshot.
4. Deploy the Phase 10 Vercel frontend and rewrite first, while the Phase 09 Railway API remains active.
5. Verify public catalog and checkout through `https://mr-clean-iota.vercel.app/api/v1/*`.
6. Re-login to `/admin` through the Vercel origin. Existing Railway-host cookies do not migrate; one expected re-login is acceptable.
7. Generate independent `CSRF_SECRET` and `AUDIT_HMAC_KEY` values in a trusted environment.
8. Set both secrets plus `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAME_SITE=strict`, and `SWAGGER_ENABLED=false` in Railway.
9. Deploy the Phase 10 Railway candidate. Its pre-deploy command validates configuration, then runs the additive audit-ledger migration.
10. Require readiness before traffic activation and inspect startup/migration logs for errors.
11. Execute the release verification below before considering the phase complete.

Do not combine an unverified Vercel change, Railway variable change, migration, and API release into one blind traffic switch.

## Release verification

Run deterministic checks before pushing:

```bash
# repository root
npm run lint
npm run test:security-headers
npm run build

# backend/
npm run lint
npm run test:coverage
npm run build
```

The PostgreSQL-backed CI job must run migrations and both E2E suites. The authentication E2E flow verifies:

- Missing and lookalike origins are rejected.
- MFA enrollment/login creates hardened cookies.
- Missing and tampered anti-CSRF tokens are rejected.
- Refresh rotation changes the session-bound token.
- Refresh replay revokes the family.
- Logout and logout-all revoke sessions.
- Catalog and order-status mutations create audit events.
- Audit rows reject update and delete.

After production deployment, verify from a clean browser profile:

1. Public catalog, product details, cart, and existing checkout still work.
2. `/api/v1/health/ready` through both Vercel and Railway reports ready.
3. `/api/v1/docs` and `/api/v1/docs-json` return 404 in production.
4. Admin password plus TOTP login succeeds on desktop and phone.
5. Refresh survives a page reload and an expired access token.
6. Session listing works and shows the current session.
7. A harmless product update succeeds, and the audit table contains its event.
8. An order status transition succeeds, and the audit table contains its event.
9. Logout-all invalidates every listed session; a new password-plus-TOTP login succeeds.
10. Browser response headers match the Vercel contract, and no browser request calls the Railway hostname directly.

Use a disposable test order and an explicitly reversible catalog update. Remove disposable business data afterward by exact ID. Audit events remain by design.

## Rollback

The database migration is additive. A Phase 09 application can run while the audit table remains present, so do not drop the ledger merely to roll back application code.

- If the Railway candidate fails validation, migration, or readiness, it must not receive traffic; keep the previous deployment active.
- If the activated API regresses, redeploy the last known-good Railway image and retain the audit table.
- The Phase 10 Vercel proxy is compatible with the Phase 09 API and can remain in place during an API rollback.
- If Vercel itself must be rolled back to the old cross-origin frontend, restore `AUTH_COOKIE_SAME_SITE=none` before that old frontend resumes admin traffic, then verify login in a clean browser.
- If a new secret was exposed, rotate that secret; a CSRF-secret rotation invalidates current CSRF tokens and requires cookie/session refresh or re-login. Audit-HMAC rotation changes future pseudonyms and should be recorded operationally.

Never run the migration `down` path in production merely as a routine rollback: it deletes the security history the phase was designed to retain.

## Deferred work

Phase 10 does not claim the application is ready for public launch by itself. The planned sequence still requires:

- Phase 11: cash-on-delivery-only checkout, required customer email, new order lifecycle, transactional email outbox, and notifications.
- Phase 12: stock movement ledger, atomic reservations/releases/finalization, thresholds, and adjustment history.
- Phase 13: dashboard metrics and activity APIs.
- Phase 14: protected operational dashboard UI, including audit-history presentation.
