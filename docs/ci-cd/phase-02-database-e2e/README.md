# Phase 02 — Ephemeral database end-to-end gate

## Outcome

CI now provisions a disposable PostgreSQL 18 service and exercises the compiled migrations and public NestJS HTTP boundary. The test database exists only inside the GitHub Actions job and receives no Railway credentials or production data.

## What was added

The `Backend E2E` job runs only after the existing backend lint, unit-test, build, and dependency-audit job succeeds. It then:

1. starts PostgreSQL with a health probe;
2. installs from the backend lockfile under Node.js 22;
3. compiles the same migration artifacts used by Railway;
4. runs every pending TypeORM migration against the ephemeral database;
5. starts the NestJS application in memory with the production middleware and routing configuration;
6. runs the API end-to-end suite;
7. destroys the database with the GitHub-hosted runner.

The application bootstrap configuration was extracted into a reusable `configureApplication` function. Production and E2E tests now share the same global prefix, validation pipe, CORS policy, cookies, security headers, exception filter integration, request IDs, and OpenAPI setup. This prevents a test-only bootstrap from drifting away from the actual server.

## Covered release risks

The E2E suite verifies:

- process liveness and PostgreSQL readiness;
- request-ID propagation;
- successful execution of the complete migration chain;
- availability of migrated categories and products;
- validated query transformation and pagination;
- the configured frontend CORS preflight;
- rejection of malformed order bodies at the global validation boundary;
- server-side order pricing;
- idempotent retries;
- conflict handling when an idempotency key is reused with a different request.

The order created during the test is isolated inside the disposable database. The suite cannot create, update, or delete a Railway production order.

## Test-only configuration

The workflow uses explicit inert values for JWT and S3 configuration because application startup validates the complete environment contract. These are not GitHub secrets and cannot access any deployed resource. The S3 endpoint uses the reserved `.invalid` top-level domain, and the tested public catalog path does not perform an upload.

## Verification

Local lint, unit tests, and compilation validate the test source and bootstrap refactor. The full E2E run requires PostgreSQL and is therefore verified on the GitHub-hosted runner before this phase is considered complete.

## Deferred work

This phase does not raise or weaken unit coverage thresholds. Coverage remediation remains separate so a green E2E result cannot conceal untested branches in storage, order administration, or authentication logic.
