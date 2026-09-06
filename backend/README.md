# Mr. Clean API

NestJS 11, TypeORM, and PostgreSQL backend for the Mr. Clean storefront. Railway is the production runtime for the API, database, and private S3-compatible product-image bucket.

## Local setup

```bash
npm install
cp .env.example .env
npm run build
npm run db:migrate
npm run dev
```

Local development needs PostgreSQL plus S3-compatible credentials matching `.env.example`. Production variables are injected by Railway service references.

## Useful routes

- Liveness: `GET /api/v1/health`
- Readiness: `GET /api/v1/health/ready`
- OpenAPI UI: `GET /api/v1/docs`
- OpenAPI JSON: `GET /api/v1/docs-json`
- Public catalog: `/api/v1/categories` and `/api/v1/products`
- Checkout: `POST /api/v1/orders`
- Administration: `/api/v1/admin/*`
- Active admin sessions: `GET /api/v1/admin/auth/sessions`
- Revoke all admin sessions: `POST /api/v1/admin/auth/logout-all`
- Finish MFA enrollment or login: `POST /api/v1/admin/auth/mfa/verify`
- Authorize first-time MFA enrollment: `POST /api/v1/admin/auth/mfa/bootstrap`
- Replace recovery codes after fresh TOTP: `POST /api/v1/admin/auth/mfa/recovery-codes`

## Commands

```bash
npm run lint
npm run test
npm run build
npm run test:coverage
npm run db:migrate
npm run db:migration:show
```

Create an MFA-disabled administrator only from a trusted environment and supply a fresh,
short-lived 32-byte Base64URL bootstrap token:

```bash
export MFA_BOOTSTRAP_TOKEN="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"
ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='use-a-long-unique-password' npm run admin:create
```

For an owner migrated from Phase 08, issue the first bootstrap authorization with
`npm run admin:mfa-bootstrap`. Emergency recovery uses `npm run admin:mfa-reset`; both commands
require the current password, an explicit confirmation phrase, and a fresh bootstrap token.
See the Phase 09 runbook before running any of these commands in production.

## Architecture record

Every completed build phase has a detailed README under `docs/phases/`:

1. Railway-ready NestJS and PostgreSQL foundation.
2. Catalog schema and public API.
3. Admin sessions, CRUD, and Railway Bucket storage.
4. Transactional orders and fulfillment states.
5. Vercel frontend integration.
6. Railway/Vercel production deployment and verification.
7. Verified 52-product PDF catalog import and production release.
8. Single-owner account, bounded session families, replay containment, and lockout.
9. Mandatory authenticator MFA, one-time recovery, and MFA-backed sessions.
