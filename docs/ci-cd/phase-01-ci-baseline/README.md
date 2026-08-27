# Phase 01 — Non-deploying CI baseline

## Outcome

The repository now has one GitHub Actions workflow that validates the frontend and backend independently on every push and pull request. This phase deliberately does not deploy, run migrations, or receive production secrets.

Keeping the first phase non-deploying limits the blast radius: the checks can be exercised and corrected before they are allowed to control a release.

## What was added

The `CI` workflow contains two jobs:

1. `Frontend checks`
   - Uses Node.js 24, matching the current Vercel project runtime.
   - Installs exactly from the root lockfile with `npm ci`.
   - Runs ESLint and the TypeScript/Vite production build.
   - Fails on high or critical dependency advisories.
2. `Backend checks`
   - Uses Node.js 22, matching the Railway Docker image.
   - Installs exactly from `backend/package-lock.json` with `npm ci`.
   - Runs ESLint, all existing unit tests, and the NestJS production build.
   - Fails on high or critical dependency advisories.

The workflow also:

- grants only read access to repository contents;
- pins third-party GitHub Actions to full commit SHAs;
- cancels obsolete runs for the same branch or pull request;
- applies a ten-minute timeout to each job;
- uses the npm cache without using cached `node_modules` as an installation source;
- contains no Vercel, Railway, database, storage, or application secrets.

## Why these controls matter

The project has two independently deployed applications and a persistent PostgreSQL database. A frontend-only build check cannot detect a broken NestJS build, while a backend-only check cannot detect a broken storefront. Independent jobs give both release boundaries a clear status and allow GitHub branch protection to require them by name.

Using the committed lockfiles prevents the CI runner from resolving a different dependency graph from the one reviewed in the repository. Explicit Node versions also keep CI aligned with the production runtimes rather than whichever Node release happens to be the runner default.

## Local verification

Before writing the workflow, the same gates were executed from clean lockfile installs:

- Frontend: install, lint, build, and dependency audit passed.
- Backend: install, lint, 19 unit tests across 8 files, build, and dependency audit passed.
- Both dependency audits reported zero known vulnerabilities at the configured threshold.

The workflow YAML was parsed locally after creation. GitHub-hosted run `33074707779` then completed successfully for commit `6bc8b96`: `Frontend checks` passed in 17 seconds and `Backend checks` passed in 27 seconds.

## Known gates intentionally deferred

Two commands are not hidden behind `continue-on-error` and are not yet presented as successful CI checks:

1. `npm run test:coverage` currently fails the configured global thresholds. The latest baseline was 68.11% statements, 54.05% branches, 49.25% functions, and 71.54% lines.
2. `npm run test:e2e` currently exits with no matching test files because `backend/test/**/*.e2e-spec.ts` has not been implemented.

The frontend also does not yet have a committed automated test suite. These are Phase 02 work. Silently allowing these commands to fail would create a green badge without a real guarantee.

## Activation sequence

1. The workflow was pushed to the non-production branch.
2. `Frontend checks` and `Backend checks` completed successfully on GitHub-hosted runners.
3. No runner-only differences were found.
4. After the test baseline is strengthened, protect `main` and require the verified checks for pull requests.

Production deployment remains owned by the existing Vercel and Railway Git integrations during this phase.
