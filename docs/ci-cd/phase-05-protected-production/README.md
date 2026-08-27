# Phase 05 — Unified and protected production branch

## Outcome

Vercel and Railway production now follow the same `main` branch and release SHA. Feature pushes create validation runs and Vercel previews without creating Railway production candidates.

The first unified release was commit `a355f83`. Vercel marked its production deployment READY, Railway completed its pre-deploy migration and readiness gate successfully, and the public API continued reporting PostgreSQL as available. The Vercel production alias returned HTTP 200 through Vercel's authenticated verification path.

## Railway source correction

Railway production previously followed `codex/mr-clean-fullstack`. That meant any backend test or feature commit could create a production candidate before review, even though Vercel production followed `main`.

The exact `mr-clean-api` production service was reconnected to `bardhh1/mr-clean` branch `main`. Reconnection deployed the existing `main` commit through the same Docker build, idempotent migration, and readiness gates. The next feature-branch backend commit created no Railway deployment, confirming that production isolation works.

## Protected `main`

GitHub branch protection now enforces:

- pull requests before changes enter `main`;
- strict, up-to-date status checks;
- `Frontend checks`;
- `Backend checks` with coverage thresholds;
- `Backend E2E` with disposable PostgreSQL;
- `CodeQL`;
- `Dependency review`;
- linear history;
- resolved review conversations;
- protection for repository administrators;
- no force pushes;
- no branch deletion.

The repository currently has one maintainer, so the approval count is zero while a pull request and every automated gate remain mandatory. Requiring one approval would prevent the pull-request author from merging their own work without adding another trusted maintainer. The approval requirement should be raised when a second maintainer joins.

## Release verification

For the unified production SHA:

- GitHub CI run `33097205281` passed all three quality jobs.
- GitHub Security run `33097205287` passed CodeQL.
- Railway deployment `38d1bd82-f575-483f-8678-d5d0cf405048` succeeded from `main`.
- Vercel deployment `dpl_4nnuxdhthabL6VvYhPPZn51nDsDk` reached READY as production.
- `/api/v1/health/ready` returned `status: ready` and `dependencies.database: up`.

## Why staging is separate

This phase aligns and protects production but does not duplicate Railway resources. An isolated staging API requires a staging environment, PostgreSQL database, object-storage policy, and separate Vercel Preview variables. Creating those resources can affect Railway usage and billing, so it is intentionally a separate owner-approved phase rather than an implicit side effect of branch protection.
