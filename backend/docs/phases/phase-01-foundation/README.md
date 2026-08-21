# Phase 01 — Railway-ready backend foundation

## Outcome

This phase establishes a production-shaped NestJS service in `backend/` and makes Railway the infrastructure boundary for both the API and PostgreSQL. It provides the runtime, database connection, migration lifecycle, security defaults, health checks, and deployment configuration that every later feature inherits.

The phase is complete when the backend installs reproducibly, compiles with strict TypeScript settings, passes lint and tests, refuses invalid configuration, publishes OpenAPI documentation, connects to PostgreSQL through one controlled pool, and is ready for Railway's build, pre-deploy migration, health-check, and restart lifecycle.

## What was implemented

### Reproducible Node 22 service

- Added a standalone `@mr-clean/api` package with exact dependency versions and a committed lockfile.
- Declared Node.js 22 as the minimum runtime and provided a multi-stage Node 22 Alpine Docker image.
- Added Nest CLI, strict TypeScript, ESLint, Vitest, coverage, and end-to-end test configurations.

Node 22 is a current long-lived runtime for this deployment. Pinning the runtime and packages removes the ambiguity created by the frontend's historical `latest` dependency ranges and keeps CI, development, and Railway on the same dependency graph.

### Railway PostgreSQL connection

- Added Nest's TypeORM integration and the PostgreSQL driver.
- Added one pooled `DATABASE_URL` connection with a bounded pool, connection timeout, and idle timeout.
- Explicitly disabled schema synchronization; production schema changes can only happen through reviewed migrations.
- Added a compiled TypeORM data source and migration scripts that work inside the production image.

Railway injects the API's database reference variable. Inside Railway this can use the Postgres service's private network URL, keeping database traffic off the public internet. A public connection string is only needed for optional local administration.

### Safe deployment migrations

- Added `npm run db:migrate`, which runs compiled pending migrations and records them in `mr_clean_migrations`.
- Added `railway.json` with `npm run db:migrate` as the pre-deploy command.
- A failed migration returns a non-zero exit code, preventing the new release from replacing the previous healthy deployment.

This matters because starting application replicas before their schema exists creates race conditions and partial outages. Railway's pre-deploy phase runs once, inside private networking, before traffic switches.

### Validated environment configuration

- Added Joi startup validation for the port, API prefix, CORS allowlist, database URL and SSL mode, pool size, access-token secret and lifetime, refresh-token lifetime, and cookie policy.
- Added a safe `.env.example`; real credentials stay in untracked `.env` files or Railway variables.
- The application fails at startup with one consolidated validation error instead of failing later during a customer order.

A partially configured API can accept data and then fail mid-workflow. Fail-fast configuration makes deployment mistakes visible before Railway routes traffic.

### HTTP platform baseline

- All routes are versioned under `/api/v1` by default.
- A global `ValidationPipe` transforms expected values and rejects unknown fields.
- CORS is credentials-aware and accepts only explicitly configured origins.
- Helmet adds defensive HTTP headers.
- A global throttler provides a baseline request ceiling; sensitive endpoints get tighter limits in later phases.
- Request IDs are accepted or generated, returned in `x-request-id`, and included in errors.
- A global exception filter returns predictable errors without exposing stack traces.

These controls are global because security and observability cannot depend on every future controller remembering to configure them independently.

### Operational endpoints and API contract

- `GET /api/v1/health` checks process liveness without touching PostgreSQL.
- `GET /api/v1/health/ready` runs `SELECT 1` so Railway only activates a release that can reach the database.
- Swagger UI is available at `/api/v1/docs` and JSON at `/api/v1/docs-json`.
- The Railway health check targets readiness, waits up to five minutes during startup, and preserves the old release when the new one never becomes ready.

Railway's deployment health check gates traffic switching; it is not continuous monitoring. A separate uptime monitor should call the same endpoint after launch.

### Container and Railway lifecycle

- The Docker build installs from the lockfile, compiles the API, creates a production-only runtime layer, and runs as the unprivileged `node` user.
- Railway config declares the Docker builder, backend-only watch paths, pre-deploy migration, start command, readiness path, failure restart policy, and graceful drain window.
- Railway must set this service's monorepo root directory to `/backend`; the colocated Vite frontend remains an independent Vercel deployment.

## Key decisions

1. **Railway owns PostgreSQL and API compute.** There is no Supabase dependency in the backend architecture.
2. **The API is the only write boundary.** The browser will stop writing directly to database or storage services after Phase 05.
3. **No automatic schema synchronization.** Every production change is explicit, reviewable, repeatable, and reversible where practical.
4. **Private database networking first.** The application uses Railway service-variable references instead of a publicly exposed database endpoint.
5. **Errors are traceable.** Every response can be correlated by request ID without exposing sensitive internals.

## Files introduced

- `backend/src/main.ts` — HTTP bootstrap, validation, CORS, headers, and OpenAPI.
- `backend/src/app.module.ts` — global configuration, throttling, filters, TypeORM, and interceptors.
- `backend/src/config/env.validation.ts` — runtime configuration contract.
- `backend/src/database/database.config.ts` — Nest database-pool configuration.
- `backend/src/database/data-source.ts` — production migration data source.
- `backend/src/health/*` — liveness/readiness behavior and tests.
- `backend/Dockerfile` — repeatable, non-root production container.
- `backend/railway.json` — deployment lifecycle as code.

## Railway resources required

The eventual Railway project contains:

1. `mr-clean-api` — GitHub-backed service rooted at `/backend`.
2. `Postgres` — Railway PostgreSQL with a persistent volume.
3. `product-images` — a Railway private S3-compatible bucket added in Phase 03.

The API variable `DATABASE_URL` should reference `${{Postgres.DATABASE_URL}}`. PostgreSQL does not need a public domain for runtime traffic.

## Verification performed

Run from `backend/`:

```bash
npm ci
npm run lint
npm run test
npm run build
```

The readiness unit test uses a controlled `DataSource` mock. A live deployment check is performed after Railway resources and variables exist.

## What this enables next

Phase 02 can add the first migration, typed entities, and public catalog controllers without rebuilding the platform concerns above. Every endpoint automatically receives versioning, validation, CORS, throttling, request IDs, error normalization, documentation support, and a production database lifecycle.
