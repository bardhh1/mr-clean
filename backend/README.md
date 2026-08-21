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

## Commands

```bash
npm run lint
npm run test
npm run build
npm run db:migrate
npm run db:migration:show
```

Create or reset an administrator only from a trusted environment:

```bash
ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='use-a-long-unique-password' npm run admin:create
```

## Architecture record

Every completed build phase has a detailed README under `docs/phases/`:

1. Railway-ready NestJS and PostgreSQL foundation.
2. Catalog schema and public API.
3. Admin sessions, CRUD, and Railway Bucket storage.
4. Transactional orders and fulfillment states.
5. Vercel frontend integration.
6. Railway/Vercel production deployment and verification.
