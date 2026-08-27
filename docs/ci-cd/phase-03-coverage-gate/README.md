# Phase 03 — Enforced backend coverage

## Outcome

Backend CI now runs the unit suite with its configured coverage thresholds and fails the job if coverage regresses below them. The thresholds remain 80% for statements, functions, and lines, and 75% for branches.

No threshold was lowered and no failing command uses `continue-on-error`.

## Coverage remediation

Focused tests were added for behavior with meaningful release or security consequences:

- product-image upload metadata and content types;
- safe object-key validation before deletion;
- private image URL signing and public/private image composition;
- active category listing and missing-category behavior;
- product filter branches, pagination, and product lookup;
- Railway client-IP normalization across proxy header shapes;
- order administration search and pagination;
- missing order behavior;
- valid, repeated, invalid, and missing-order status transitions.

One stale unit-test description was corrected from Supabase to PostgreSQL so the test describes the deployed dependency accurately.

## Coverage scope

TypeORM entity declarations and database migration implementations are excluded from unit coverage calculations:

- Entity files are declarative persistence metadata rather than executable business workflows.
- Migrations are executed as compiled artifacts against PostgreSQL by the mandatory `Backend E2E` job.

Counting decorator declarations and hundreds of catalog seed rows as uncovered unit branches distorted the signal and encouraged tests that would duplicate the stronger migration gate. The exclusions do not remove service, guard, authentication, validation, storage, catalog, or order logic from coverage.

## Verified local baseline

The enforced baseline is:

- 31 tests across 9 unit-test files;
- 94.21% statements;
- 82.82% branches;
- 94.00% functions;
- 95.23% lines.

Lint, coverage, and the NestJS production build pass together. A GitHub-hosted run is required before this phase is made a protected-branch requirement.

## Deployment isolation correction

Before pushing this backend test-only phase, the Railway production source was changed from `codex/mr-clean-fullstack` to `main`. This prevents test and feature commits from creating production API candidates before review. The source change selected the existing `main` commit and remained subject to Railway's migration and readiness gates.
