# Mr. Clean

Production storefront and order platform for Mr. Clean, a Kosovo sanitary-supply business. Vercel serves the Vite/React frontend; Railway runs the NestJS API, PostgreSQL, and private product-image storage.

## Features

- Albanian-first public storefront with EUR pricing.
- Product catalog, category filters, search, detail pages and localStorage cart.
- Transactional, idempotent checkout followed by a prefilled WhatsApp confirmation.
- Cookie-authenticated administration for catalog, images, and order fulfillment.
- Server-authoritative EUR pricing and immutable order-item snapshots.
- Demo catalog fallback only when no API URL is configured.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Run the NestJS API separately from `backend/`, then set:

```bash
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_WHATSAPP_PHONE=38344123456
VITE_SITE_URL=http://localhost:5173
```

## Backend

```bash
cd backend
npm install
cp .env.example .env
npm run build
npm run db:migrate
npm run dev
```

The API is versioned under `/api/v1`. OpenAPI is available at `/api/v1/docs`, and Railway readiness uses `/api/v1/health/ready`.

Detailed implementation records live under `backend/docs/phases/`. Each completed phase explains its schema, endpoints, security decisions, Railway impact, and verification.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```

Backend scripts are documented in `backend/README.md` and the phase guides.
