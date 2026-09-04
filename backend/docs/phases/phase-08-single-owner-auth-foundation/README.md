# Phase 08 — Single-owner authentication foundation

## Outcome

The custom NestJS administrator authentication boundary is now constrained for one active owner and has a bounded, traceable session lifecycle. This phase deliberately hardens the backend before MFA, browser CSRF/CSP controls, the cash-on-delivery email flow, or dashboard UI work begins.

The implementation keeps the existing high-entropy opaque refresh secret and short-lived JWT access cookie, then adds the invariants that were missing:

- PostgreSQL permits at most one active administrator.
- Consecutive password failures lock that account for a configurable period.
- Attempts made during an active lock do not extend its deadline.
- Every login creates a refresh-session family with a fixed absolute expiry.
- Refresh rotates to a linked child without extending the family lifetime.
- Reuse of a correctly signed, already-rotated refresh token marks the family compromised and revokes every descendant.
- Access tokens carry a version, issuer, audience, algorithm restriction, session ID, and unique JWT ID.
- Password reprovisioning revokes all active sessions.
- Refresh, logout, logout-all, and password reprovisioning serialize on the owner row.
- The owner can inspect active sessions and revoke all of them through guarded endpoints.

## Why this phase comes before the dashboard

An admin interface is not a security boundary. The browser can hide buttons, but only NestJS and PostgreSQL can decide whether a request is authenticated and whether its session remains valid. Building these rules first means every later dashboard feature inherits immediate revocation, bounded lifetime, account lockout, and a single-owner database invariant.

This phase also avoids mixing security behavior with dashboard presentation. MFA enrollment, CSRF/CSP, audit events, inventory, sales metrics, and email delivery each have different failure and rollback behavior and remain separate phases.

## Database changes

Migration `1788021000000-single-owner-auth-foundation.ts` upgrades the existing tables without deleting identities or sessions.

### `admin_users`

Added:

- `failed_login_count`
- `last_failed_login_at`
- `locked_until`
- `password_changed_at`

The role constraint now accepts only the existing `admin` value. A partial unique index over active rows enforces at most one active administrator while preserving inactive historical identities.

The migration refuses to continue when more than one active administrator already exists. It does not guess which identity should survive, deactivate users, or delete security history. That failure is intentional because resolving identity ownership requires an explicit operator decision.

### `admin_sessions`

Added:

- `family_id`
- `parent_session_id`
- `rotated_to_session_id`
- `family_expires_at`
- `revocation_reason`
- `compromised_at`

Existing sessions are placed into one-member families and keep their existing expiry as the family boundary. They are not granted additional lifetime by the migration. Existing revoked sessions receive a conservative `logout` reason.

Self-referential foreign keys preserve the rotation chain. Checks reject self-parent and self-rotation links, and the revocation reason is constrained to the supported state vocabulary.

## Authentication behavior

### Login

The login path performs one scrypt verification even when the email does not exist, reducing the timing difference between unknown-email and incorrect-password requests. Invalid credentials return the same public error.

Failed attempts are serialized with a pessimistic row lock. At `ADMIN_MAX_FAILED_LOGINS`, the account is locked for `ADMIN_LOCKOUT_MINUTES`. A successful login clears the failure state and creates a new session family.

The active deadline is immutable: attempts received while the account is already locked return the generic authentication error without incrementing the counter or moving `locked_until`. This keeps the lockout useful against guessing without letting sparse requests hold the sole owner in an endless lock.

The HTTP endpoint retains its five-attempts-per-minute IP throttle. Account lockout is a second control that works across distributed IP addresses.

### Refresh rotation

Refresh tokens remain `<session-id>.<random-secret>`. PostgreSQL stores only the SHA-256 digest of the 48-byte random secret. SHA-256 is appropriate here because the input is generated high-entropy material rather than a human password.

The current session row is locked before evaluation. A valid refresh:

1. Revokes the current row with reason `rotated`.
2. Creates a child with the same family ID and absolute expiry.
3. Links the parent and child.
4. Returns a new access and refresh cookie.

If the old token is presented again with the correct secret, the request is treated as evidence that the rotated credential escaped its intended client. Every session in the family receives `reuse_detected` and `compromised_at`, including the newest descendant. The owner must sign in again.

This conservative rule can invalidate two browser tabs that refresh the same credential concurrently. That is an accepted security-first tradeoff for a single-owner dashboard; the frontend already coalesces refreshes within one tab.

Refresh acquires a pessimistic lock on the sole owner before it locks or rotates the session row. Logout, logout-all, and password reprovisioning take the same owner lock in the same order. That shared serialization point prevents a refresh child from being inserted outside a concurrent revocation.

Current-device logout authenticates the supplied opaque refresh secret even when its parent has already rotated, then revokes every still-active descendant in that family. Other independent device/login families remain active; logout-all revokes all of them.

### Absolute lifetime

`REFRESH_TOKEN_TTL_DAYS` is the rolling lifetime for one refresh row. `REFRESH_TOKEN_ABSOLUTE_TTL_DAYS` is the maximum lifetime of the family from the original login. Startup validation requires the absolute value to be at least the rolling value.

Rotation never moves the absolute boundary. This prevents a permanently active browser from refreshing forever.

### Access-token validation

New access tokens include version `2` and are signed with HS256 using the configured issuer and audience. Verification pins all four properties:

- algorithm: `HS256`
- issuer: `JWT_ACCESS_ISSUER`
- audience: `JWT_ACCESS_AUDIENCE`
- token version: `2`

The guard still loads the backing session and administrator from PostgreSQL. Revocation, compromise, expiry, account disablement, and the single supported role therefore take effect without waiting for the JWT to expire.

Old versionless access cookies are intentionally rejected after deployment. An unexpired legacy refresh session can rotate once into the new format because the migration backfills its family boundary.

## Session-management endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/admin/auth/sessions` | Return at most 20 active sessions and identify the current one. |
| `POST` | `/api/v1/admin/auth/logout-all` | Revoke every active session for the owner and clear the caller's cookies. |

Both endpoints require an active access session and the existing trusted-client header. The header remains only a narrow browser/request-shape signal; it is not considered a secret or an authorization mechanism.

Session responses never expose refresh-token digests, rotation links, or compromised historical rows.

## Owner provisioning and password rotation

`npm run admin:create` remains the trusted one-off provisioning command. It now:

- Refuses to activate a different email while another active owner exists.
- Resets lockout state.
- Updates `password_changed_at`.
- Revokes every active session with reason `password_changed`.

Changing the password therefore cannot leave an already-authenticated browser active. `ADMIN_PASSWORD` remains an ephemeral command variable and must not be stored in Railway's long-lived service configuration.

## Environment contract

New validated variables:

```dotenv
JWT_ACCESS_ISSUER=mr-clean-api
JWT_ACCESS_AUDIENCE=mr-clean-admin
REFRESH_TOKEN_ABSOLUTE_TTL_DAYS=45
ADMIN_MAX_FAILED_LOGINS=5
ADMIN_LOCKOUT_MINUTES=15
```

Existing production values remain valid through defaults, but the variables should be set explicitly in Railway before deployment so the runtime policy is visible to operators.

## Deployment sequence

1. Confirm the database contains at most one active row:

   ```sql
   SELECT id, email, role, is_active
   FROM admin_users
   WHERE is_active;
   ```

2. Add the five explicit environment values above to the Railway API service.
3. Deploy the candidate. Railway's pre-deploy command runs the migration before the new code starts.
4. Confirm readiness.
5. Sign in with the owner account.
6. Verify `/admin/auth/sessions` returns the current session.
7. Refresh once and confirm the admin remains authenticated.
8. Use logout-all and confirm the next privileged request returns `401`.
9. Sign in again before beginning later admin work.

The migration and code are forward-compatible during the deployment boundary: old sessions are backfilled, while old access tokens are rejected deliberately and can use their refresh cookie once to obtain version 2.

## Rollback

The application can be rolled back to the previous image without immediately reversing the migration; the old entity model ignores the additive columns, and the existing columns keep their original meanings.

Do not run the migration's `down` method as the first response to an application regression. Rolling back the image is safer because reversing the migration removes session-family evidence and the single-owner invariant.

If a full schema rollback is explicitly required:

1. Stop admin traffic.
2. Revoke all sessions.
3. Preserve a database backup.
4. Run the migration down only after confirming no later migration depends on the new columns.
5. Reprovision the owner password after the old application is active.

## Verification

Unit coverage exercises:

- Versioned JWT creation and validation.
- Rolling versus absolute expiry.
- Account lockout.
- Lock-deadline immutability while the account is locked.
- Rotation-chain linkage.
- Full-family refresh replay containment.
- Owner-before-session lock ordering for refresh and revocation flows.
- Family revocation when logout receives a rotated parent.
- Legacy access-token rejection.
- Logout-all.
- Environment lifetime validation.
- Migration security intent.

The PostgreSQL E2E suite additionally exercises real cookie rotation, replay containment, access invalidation, and logout-all against the migrated schema.

Run from `backend/`:

```bash
npm run lint
npm run test
npm run test:coverage
npm run build
npm run db:migrate
npm run test:e2e
```

The final two commands require the ephemeral PostgreSQL service used by CI or an equivalent local test database.

## Explicit non-goals

This phase does not claim to finish the security foundation. It does not add:

- MFA or recovery codes.
- CSRF tokens, strict Origin checks, or CSP.
- Append-only audit events.
- Production Swagger restrictions.
- Cash-on-delivery order-state changes.
- Customer email confirmation.
- Inventory quantities or reservations.
- Dashboard metrics or UI.

Those remain visible rather than being implied by stronger session handling. The next security phase should add mandatory authenticator-app MFA and recovery-code handling, followed by browser/API hardening and audit logging.
