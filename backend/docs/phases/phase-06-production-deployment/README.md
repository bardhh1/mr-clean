# Phase 06 — Railway and Vercel production deployment

## Outcome

The Mr. Clean stack is live across two independent production boundaries:

- Storefront: `https://mr-clean-iota.vercel.app`
- API: `https://mr-clean-api-production.up.railway.app/api/v1`
- API readiness: `https://mr-clean-api-production.up.railway.app/api/v1/health/ready`
- API documentation: `https://mr-clean-api-production.up.railway.app/api/v1/docs`

Vercel serves the static Vite/React application. Railway runs the containerized NestJS API, PostgreSQL 18, and a private S3-compatible `product-images` bucket in Amsterdam.

## Railway resources

The `mr-clean` Railway project contains:

1. `mr-clean-api` — one non-root Node 22 container in `ams`.
2. `Postgres` — PostgreSQL 18 with a persistent volume and private-network endpoint.
3. `product-images` — a private bucket in `ams`.

Only the API has a public HTTP domain. PostgreSQL has no persistent TCP proxy, and the bucket has no anonymous access. API-to-database traffic uses `${{Postgres.DATABASE_URL}}` inside Railway private networking.

## Monorepo deployment configuration

The API service root is `/backend`, while its config file path is the repository-absolute `/backend/railway.json`. Railway evaluates watch patterns from the repository root, so the final pattern is `/backend/**`.

This matters for two reasons:

- Frontend-only commits do not rebuild the API.
- Compiler, Dockerfile, migration, documentation, or other backend changes do rebuild it.

The Dockerfile is multi-stage, installs from the lockfile, compiles strict TypeScript, removes development dependencies from the runtime image, and runs as the unprivileged `node` user.

## Production variables

Values are stored in Railway or Vercel and are not committed. The API has validated variables for:

- Runtime, API prefix, port, and allowed Vercel origin.
- Private PostgreSQL URL, SSL policy, and bounded pool.
- Generated JWT signing secret and token lifetimes.
- `Secure; SameSite=None` admin cookies for the Vercel-to-Railway boundary.
- Railway Bucket endpoint, credentials, bucket name, region, and S3 URL style.

Vercel has `VITE_API_BASE_URL` for Production, Preview, and Development. Vite embeds the value during the build; the production frontend was rebuilt only after the Railway domain and readiness checks were healthy.

## Migration and health gate

Every API deployment follows:

1. Build the Docker image.
2. Run `npm run db:migrate` as Railway's pre-deploy command.
3. Start the candidate container.
4. Call `/api/v1/health/ready` until PostgreSQL reports `up`.
5. Route traffic only after readiness succeeds.

The three migrations create and seed the catalog, add revocable admin sessions, and add transactional orders. TypeORM records them in `mr_clean_migrations`; rerunning the command is safe.

## Clean-build incidents and protections

Two release candidates were rejected before becoming healthy:

1. A clean Docker build exposed TypeScript 6's requirement for an explicit build `rootDir`. The fix belongs in `tsconfig.build.json` with `src/**/*.ts` as the build include, while test configuration remains outside the production program.
2. Railway's bucket credential output calls virtual-host addressing `virtual-host`; the AWS SDK configuration contract uses `virtual`. Startup validation rejected the mismatch until the provider value was normalized.

A separate Railway variable update briefly attempted to use the repository's `main` branch because the Railway GitHub App does not yet have access to the repository. That source was disconnected immediately. The healthy service uses an explicit CLI upload of the pushed `codex/mr-clean-fullstack` code, preventing an older branch from replacing the verified image.

These failures demonstrate why compile checks, startup validation, migration gates, and readiness checks precede traffic switching.

## Edge-aware throttling and request IDs

Railway's edge supplies the normalized client address in `X-Real-IP`. The API's throttler tracks that value, falling back to Express or socket addresses outside Railway. Without this adapter, all customers could share the edge proxy's rate-limit bucket.

The request-ID interceptor accepts a caller's bounded `x-request-id`, then Railway's `x-railway-request-id`, then generates a UUID. Errors and response headers therefore correlate with Railway HTTP logs without exposing stack traces.

## Production verification

### API and database

- Liveness returned `status: ok`.
- Readiness returned `status: ready` and `dependencies.database: up`.
- Four category slugs and six seeded products loaded from PostgreSQL.
- The Vercel-origin CORS preflight for `POST /orders` returned `204`.
- The production OpenAPI and versioned routes are reachable.

### Transactional checkout

A synthetic order containing two 5L floor-cleaner units returned:

- `pending_whatsapp`
- EUR currency
- Server-calculated total of 1,780 cents
- A customer-facing `MC-...` reference

Submitting the identical idempotency key returned the same order ID. Reusing the key with quantity three returned `409`. The synthetic order was then deleted by exact test markers, its cascading line items were removed, and a follow-up query confirmed zero synthetic orders remain.

### Private bucket

Using the API service's injected S3 credentials, verification wrote a synthetic object, read back the exact body, and deleted it in a `finally` block. No test object remains.

### Browser

The in-app browser loaded the production catalog from Vercel, rendered all six API products, and opened a direct SPA route successfully. `/admin` rendered the real NestJS login boundary rather than the previous no-API/Supabase fallback.

### Temporary access cleanup

- The short-lived PostgreSQL TCP proxy used to remove the synthetic order was deleted immediately.
- The short-lived Railway SSH key attempted before the TCP fallback was unregistered and its local files removed.
- PostgreSQL and the private bucket remain without public access.

## Verification commands

Frontend, from the repository root:

```bash
npm run lint
npm run build
```

Backend, from `backend/`:

```bash
npm run lint
npm run test
npm run build
```

Operational checks:

```bash
curl -fsS https://mr-clean-api-production.up.railway.app/api/v1/health/ready
railway deployment list --service mr-clean-api --environment production --json
railway logs --service mr-clean-api --environment production --lines 100
```

## Deployment runbook

Until the Railway GitHub App is granted access to `bardhh1/mr-clean`, deploy the API explicitly from `backend/`:

```bash
npx @railway/cli up \
  --service mr-clean-api \
  --environment production \
  --message "describe the release"
```

After granting repository access, reconnect the service to `bardhh1/mr-clean`, branch `codex/mr-clean-fullstack`, retain `/backend` as the root and `/backend/railway.json` as the config path, and verify the deployment trigger before relying on auto-deploy.

For Vercel, ensure `VITE_API_BASE_URL` already points to the healthy Railway domain, then deploy the repository root to the existing `mr-clean` project.

## Rollback

Railway keeps prior deployments available. If a candidate fails its migration or readiness check, it does not receive traffic. For a post-activation regression, redeploy the last known-good image and avoid reversing a migration until its compatibility is understood.

Vercel deployments are immutable; promote the previous ready deployment to restore the storefront independently of the API.

## Production ownership still required

The infrastructure is live, but two owner decisions are intentionally not fabricated:

1. **First admin identity.** No password was generated or exposed. Provision it later with `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `npm run admin:create` from a trusted Railway environment.
2. **Backup/availability tier.** The current Railway trial database has PITR and HA disabled. Before accepting material order volume, choose the paid retention and availability policy that matches the business, enable PITR or scheduled backups, and test restoration. HA is a separate cost/availability decision.

These are operational ownership choices, not missing application code. Secrets, billing commitments, and an administrator identity should not be guessed by the implementation process.
