# Phase 04 — Security and dependency controls

## Outcome

The repository now performs static security analysis and blocks high-severity dependency regressions in pull requests. Dependency updates for the frontend, backend, and GitHub Actions are generated as reviewable pull requests on a controlled weekly schedule.

No production credential is stored or requested by these workflows.

## Static analysis

The `Security` workflow runs GitHub CodeQL for JavaScript and TypeScript on:

- pushes to `main`;
- pushes to Codex feature branches;
- pull requests targeting `main`;
- a weekly schedule;
- manual dispatch.

CodeQL receives read-only repository and package access plus the narrowly required `security-events: write` permission for uploading its analysis. The workflow does not receive Vercel, Railway, PostgreSQL, JWT, S3, or admin credentials.

The CodeQL actions are pinned to the full commit SHA for version 3.37.9 so an upstream tag cannot silently change the executable workflow code.

## Dependency controls

The main CI workflow already runs `npm audit --audit-level=high` after deterministic installs for both applications. Pull requests now also run GitHub's dependency-review action and fail when a changed dependency introduces a high or critical known vulnerability.

The dependency-review action and checkout action are pinned to full commit SHAs.

Dependabot checks three independent package ecosystems every Monday in the project timezone:

1. root npm dependencies;
2. backend npm dependencies;
3. GitHub Actions references.

Minor and patch updates are grouped per application to reduce pull-request noise. Major updates remain separate because they deserve isolated review and migration testing.

## Reproducible frontend declarations

The frontend previously declared most packages as `latest`. Although the lockfile pinned an installed graph, a routine install could rewrite dependencies without making the intended version change obvious in `package.json`.

Every direct frontend dependency and development dependency is now declared at the exact version already present in the verified lockfile. This changes no installed package version. Future updates must arrive as explicit source changes and pass CI, coverage, E2E, CodeQL, and dependency review as applicable.

## Remaining repository setting

GitHub secret scanning and push protection are repository-level controls rather than workflow files. They should be enabled in the repository's Code security settings before admin credentials or deployment tokens are introduced to any developer workflow.

## Verification

The pinned declarations were validated with a clean `npm ci`, lint, production build, and complete dependency audit. GitHub Actions security run `33096765744` completed successfully for commit `ee23bb4`, including the CodeQL analysis. Dependency review was correctly skipped because the triggering event was a branch push; it is scoped to pull requests. CI run `33096765575` independently passed all three quality jobs for the same commit.
