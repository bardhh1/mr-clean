# Phase 09 — Mandatory administrator MFA and secure recovery

## Outcome

Phase 09 establishes the security boundary required before the owner dashboard grows into a business-critical system. The sole administrator cannot obtain a session with a password alone, and a stolen password cannot be used to claim the first authenticator factor.

The completed flow requires:

1. The administrator password.
2. A separate, operator-issued bootstrap authorization when MFA has not yet been enrolled.
3. A fresh TOTP or one unused recovery code for every later login.

Only the final MFA transaction can create access and refresh credentials. The migration revokes every pre-MFA session and adds a database constraint that prevents old application code from creating another active password-only session during a rolling deployment.

This phase also adds bounded MFA challenge storage, one-time recovery codes, login timing equalization, strict production cookie and CORS validation, secure Vercel response headers, and operator-only bootstrap/reset commands.

## Why it matters

The dashboard controls products, prices, stock, orders, customer details, and eventually sales metrics. Compromise of its only administrator would affect both operations and customer data.

There is no second administrator who can approve enrollment or recovery. The design therefore uses a controlled operator path instead of email recovery:

- The database stores only a digest of the short-lived bootstrap token.
- The token is generated and handled by the owner in a trusted Railway-capable terminal.
- The current password is still required.
- Enrollment consumes the bootstrap token atomically before the TOTP seed is disclosed.
- Emergency reset revokes every session and requires another fresh bootstrap token.

Email is deliberately not an authentication factor or an MFA recovery factor.

## Security review and resolved findings

A repository-wide Codex Security review was completed against the initial Phase 09 implementation. It found four issues, all resolved in this phase:

| Finding | Risk before remediation | Resolution |
| --- | --- | --- |
| Password-only first enrollment | A password thief could receive and enroll the new TOTP seed. | Added a separate, expiring, one-time operator bootstrap token and a distinct bootstrap challenge state. |
| Challenge churn | Correct-password requests invalidated other devices and retained unbounded rows. | Preserved valid concurrent challenges, capped active challenges per owner, and pruned consumed/expired rows under the owner lock. |
| Clickjacking | `/admin` could be framed by another site. | Added CSP `frame-ancestors 'none'`, `X-Frame-Options: DENY`, and supporting security headers in `vercel.json`, with a CI contract test. |
| Invalid-login timing difference | An existing email performed an extra database transaction. | Added a configurable minimum failure duration with bounded jitter while retaining the generic response and endpoint throttle. |

Additional hardening completed during the review:

- Strict 32-byte Base64URL contracts for the MFA encryption key and recovery pepper.
- Cross-field rejection when JWT, encryption, and recovery secrets are reused.
- Production-only enforcement of `Secure` plus `SameSite=None` cookies for the Vercel-to-Railway topology.
- Canonical HTTPS production CORS origins with no wildcards, paths, credentials, queries, or fragments.
- Full runtime environment validation before the migration command can touch PostgreSQL.
- Session validity, expiry, compromise, role, and MFA checks before recovery-code replacement.
- A persistent recovery-code-use warning and an actual regeneration flow in the dashboard.
- An explicit acknowledgement before one-time recovery codes can be dismissed.

## Threat model

### Protected assets

- The single administrator identity and password verifier.
- The TOTP seed and recovery-code verifiers.
- Access tokens, refresh tokens, and session families.
- Catalog, stock, order, and future sales-metric authority.
- Railway environment secrets and PostgreSQL records.

### Trust boundaries

- Public browser to the Vercel frontend.
- Vercel-hosted frontend to the Railway API over cross-origin HTTPS.
- Railway API to PostgreSQL.
- Trusted operator shell to bootstrap and emergency-reset scripts.

### Important assumptions

- Railway terminates TLS and overwrites the client-address header consumed by the API throttle.
- Railway, Vercel, GitHub, database, and storage access is limited to trusted operators.
- The owner does not copy passwords, bootstrap tokens, TOTP seeds, recovery codes, cookies, or production secrets into tickets, chat, source control, or logs.
- There is exactly one active administrator, enforced by the Phase 08 database constraint.

The `x-mr-clean-client` header is a request-shape and CORS-preflight control. It is public and is never treated as authentication.

## Authentication state machine

```text
Password accepted
      |
      +-- MFA disabled --> bootstrap challenge (no TOTP seed)
      |                         |
      |                         +-- valid operator token --> enrollment challenge + TOTP seed
      |                                                            |
      |                                                            +-- fresh TOTP --> MFA session
      |
      +-- MFA enabled --> login challenge
                                |
                                +-- fresh TOTP or unused recovery code --> MFA session
```

No branch before the final factor verification can create session cookies.

## Password step

`POST /api/v1/admin/auth/login` performs the Phase 08 password verification and lockout logic. Unknown emails use a precomputed dummy password hash so password work has the same shape. Every invalid credential result is padded to `ADMIN_LOGIN_MIN_DURATION_MS` plus bounded jitter; valid logins are not delayed.

After a valid password, the service locks and reloads the owner row, verifies that the account and password version are still current, prunes consumed or expired challenges, and counts the remaining active challenges. It rejects creation with HTTP 429 when `MFA_MAX_ACTIVE_CHALLENGES` is reached.

The new challenge:

- Has a random 256-bit browser secret.
- Stores only the SHA-256 digest of that secret.
- Expires after `MFA_CHALLENGE_TTL_SECONDS`.
- Is bound to the current `password_changed_at` value.
- Shares the account-wide failure and lockout budget.
- Returns `mode: bootstrap` when MFA is disabled and `mode: verify` when MFA is enabled.

Multiple valid devices can hold independent challenges until one expires or is consumed. Starting another login does not invalidate a legitimate challenge on a different device.

## Bootstrap authorization

Password possession is intentionally insufficient to start factor enrollment.

When MFA is disabled, password login returns `mode: bootstrap` and no `setup`, TOTP secret, or session cookie. The operator must first provision a random 32-byte token using `npm run admin:mfa-bootstrap`, `npm run admin:create`, or the emergency reset command.

PostgreSQL stores:

- `mfa_bootstrap_token_hash`: SHA-256 over the decoded 32 random bytes.
- `mfa_bootstrap_expires_at`: a bounded expiry, 15 minutes by default.

`POST /api/v1/admin/auth/mfa/bootstrap` verifies the password challenge and bootstrap token inside one owner-locked transaction. On success it:

1. Clears the token digest and expiry from the owner record.
2. Rotates the browser challenge secret so the password-stage token cannot be replayed.
3. Changes the challenge from `bootstrap` to `enrollment`.
4. Generates the TOTP seed.
5. Encrypts the pending server copy before saving it.
6. Returns the `otpauth://` URI and manual Base32 seed.

Malformed, incorrect, expired, and reused bootstrap tokens fail with the same generic MFA response. Incorrect tokens consume both the challenge attempt budget and the serialized owner failure budget.

## TOTP enrollment and later verification

TOTP follows RFC 6238 using HMAC-SHA-1, six digits, and a 30-second period for broad authenticator compatibility. Verification accepts the current counter plus one adjacent counter in either direction for bounded clock drift.

The last accepted counter is stored on the owner. The same TOTP time-step cannot be accepted again, including through a second concurrent challenge.

For an enrollment challenge, `POST /api/v1/admin/auth/mfa/verify`:

1. Decrypts the pending secret with challenge-specific authenticated data.
2. Verifies a fresh TOTP.
3. Re-encrypts the seed with owner-specific authenticated data.
4. Sets `mfa_enabled`, `mfa_enrolled_at`, and `last_totp_counter` together.
5. Replaces recovery material with ten new one-time codes.
6. Consumes the challenge.
7. Creates the first MFA-verified session.
8. Returns the recovery codes exactly once.

For later login challenges, the endpoint accepts either a fresh TOTP or one unused recovery code. Recovery-code lookup, use, owner update, challenge consumption, and session creation occur in one owner-locked transaction.

## Recovery codes

Each of the ten codes contains 80 random bits and is displayed as four groups of four Base32 characters. PostgreSQL stores only HMAC-SHA-256 digests keyed by `MFA_RECOVERY_PEPPER`.

The UI keeps plaintext codes only in component memory. They are displayed in one column on narrow screens, and the owner must explicitly acknowledge saving every code before continuing.

When a recovery code is used:

- It receives `used_at` in the same transaction that creates the session.
- Reuse is rejected.
- The API returns `used_recovery_code: true`.
- The admin UI displays a persistent warning.
- The security panel lets the owner replace all codes after a fresh TOTP.

`POST /api/v1/admin/auth/mfa/recovery-codes` requires an active, unexpired, uncompromised, MFA-backed session, the administrator role, the trusted request shape, a fresh unreplayed TOTP, and a three-per-minute endpoint throttle.

## Cryptographic storage

### TOTP secret

TOTP requires the server to reproduce authenticator outputs, so the shared seed cannot be one-way hashed. It is encrypted with AES-256-GCM:

- A fresh 96-bit IV is generated for every encryption.
- The authentication tag detects tampering.
- Authenticated data binds a pending seed to its challenge ID and an enrolled seed to its owner ID.
- The envelope is versioned as `v1` for future key rotation.
- `MFA_ENCRYPTION_KEY` must be the unpadded 43-character Base64URL encoding of exactly 32 random bytes.

### Recovery pepper

`MFA_RECOVERY_PEPPER` must also be the unpadded 43-character Base64URL encoding of exactly 32 independent random bytes. It must not equal the encryption key or JWT signing secret.

### Bootstrap and challenge tokens

Bootstrap and challenge tokens contain 256 random bits. Only SHA-256 digests are stored. Their strength comes from random generation rather than a user-selected password, so a fast digest is appropriate.

## Database migration

Migration `1788480000000-admin-mfa-foundation.ts` adds the following controls.

### `admin_users`

- `mfa_enabled`
- `mfa_secret_ciphertext`
- `mfa_enrolled_at`
- `last_totp_counter`
- `mfa_bootstrap_token_hash`
- `mfa_bootstrap_expires_at`

`ck_admin_users_mfa_state` allows only coherent states:

- Disabled MFA has no enrolled seed, enrollment timestamp, or accepted TOTP counter; bootstrap digest and expiry are either both null or both present.
- Enabled MFA has an encrypted seed, enrollment timestamp, and accepted counter; bootstrap digest and expiry are both null.

### `admin_sessions`

- Adds `mfa_verified_at`.
- Adds `mfa_enrollment_required`, `mfa_bootstrap_issued`, and `mfa_reset` revocation reasons.
- Revokes every active pre-MFA session.
- Adds `ck_admin_sessions_active_requires_mfa`, requiring every non-revoked row to have `mfa_verified_at`.

The last constraint blocks an old Phase 08 application instance from creating a password-only active session after the migration has run.

### `admin_mfa_challenges`

Stores `bootstrap`, `enrollment`, and `login` challenges, their owner, token digest, password version, attempt count, expiry, consumption time, and optional encrypted pending seed. Database checks permit the encrypted pending seed only for `enrollment`.

### `admin_mfa_recovery_codes`

Stores owner-scoped code digests and one-time consumption timestamps. A unique owner/digest constraint plus owner serialization prevents concurrent reuse.

## API contract

| Method | Path | Requirement | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/admin/auth/login` | Password + trusted request shape | Create `bootstrap` or `verify` challenge; never create a session. |
| `POST` | `/api/v1/admin/auth/mfa/bootstrap` | Password challenge + operator token + trusted request shape | Consume bootstrap authorization and disclose enrollment setup. |
| `POST` | `/api/v1/admin/auth/mfa/verify` | Enrollment/login challenge + TOTP or permitted recovery code + trusted request shape | Complete MFA and create an authenticated session. |
| `POST` | `/api/v1/admin/auth/mfa/recovery-codes` | MFA session + fresh TOTP + trusted request shape | Replace every recovery code. |
| `POST` | `/api/v1/admin/auth/refresh` | MFA-backed refresh cookie + trusted request shape | Rotate the refresh session within its bounded family. |
| `POST` | `/api/v1/admin/auth/logout` | Refresh cookie + trusted request shape | Revoke the active refresh family. |
| `POST` | `/api/v1/admin/auth/logout-all` | MFA session + trusted request shape | Revoke every active administrator session. |

Authentication responses send `Cache-Control: no-store` when they contain challenge material, enrollment data, recovery codes, session metadata, or cookie rotation.

## Frontend behavior

The `/admin` route has five explicit authentication states:

1. Password sign-in.
2. Operator bootstrap-token authorization when MFA is disabled.
3. Authenticator enrollment or normal MFA verification.
4. One-time recovery-code display with explicit acknowledgement.
5. Authenticated administration.

Password, bootstrap, and MFA submit buttons disable while requests are pending, preventing accidental duplicate challenge creation. The TOTP seed, bootstrap token, and recovery codes are never stored in local storage or session storage.

The Vercel edge adds:

- CSP with `frame-ancestors 'none'`, `base-uri 'self'`, and `object-src 'none'`.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: no-referrer`.
- A restrictive `Permissions-Policy`.
- Two-year HSTS with subdomains and preload.

`npm run test:security-headers` validates the version-controlled header contract, and CI runs it on every push and pull request.

## Runtime environment contract

Production must set:

```dotenv
NODE_ENV=production
CORS_ORIGINS=https://mr-clean-iota.vercel.app
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=none
ADMIN_LOGIN_MIN_DURATION_MS=500
MFA_ENCRYPTION_KEY=<43-character Base64URL value for 32 random bytes>
MFA_RECOVERY_PEPPER=<different 43-character Base64URL value for 32 random bytes>
MFA_ISSUER=Mr. Clean Admin
MFA_CHALLENGE_TTL_SECONDS=300
MFA_MAX_ATTEMPTS=5
MFA_MAX_ACTIVE_CHALLENGES=3
MFA_BOOTSTRAP_TTL_MINUTES=15
```

Generate the JWT secret, encryption key, recovery pepper, and every bootstrap token independently. This creates one 32-byte Base64URL value without padding:

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
```

Do not commit, persist in ordinary shell history, or copy real values into documentation or chat.

`npm run db:migrate` now runs the compiled runtime validator before TypeORM. A candidate with missing MFA secrets, weak cookie settings, non-HTTPS production CORS, or another invalid runtime value fails before the migration can revoke sessions or change the schema.

## First production enrollment

Phase 08 must already be deployed and verified.

1. Create and verify a Railway PostgreSQL backup or snapshot.
2. Generate and store independent JWT, MFA encryption, and recovery-pepper secrets.
3. Set every production environment value above before deploying.
4. Deploy the Phase 09 candidate. The pre-deploy migration validates the environment first.
5. Verify API readiness. Existing sessions should now be revoked.
6. In a trusted terminal, create a fresh bootstrap token without typing its value into shell history:

   ```bash
   export MFA_BOOTSTRAP_TOKEN="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"
   ```

7. Run the bootstrap command from a trusted environment connected to production:

   ```bash
   export ADMIN_EMAIL='owner@example.com'
   read -s ADMIN_PASSWORD
   export ADMIN_PASSWORD
   export MFA_BOOTSTRAP_CONFIRM="ISSUE-MFA-BOOTSTRAP-${ADMIN_EMAIL}"
   npm run admin:mfa-bootstrap
   ```

8. On macOS, copy the token directly from that trusted terminal without printing it:

   ```bash
   printf '%s' "$MFA_BOOTSTRAP_TOKEN" | pbcopy
   ```

   Paste it into the admin bootstrap screen. Do not send it through email or chat.
9. Add the returned TOTP account to the authenticator, verify the first code, and save all recovery codes offline.
10. Verify session listing, refresh rotation, logout, a second password-plus-TOTP login, and one-time recovery-code behavior.
11. Clear ephemeral shell values:

    ```bash
    unset ADMIN_EMAIL ADMIN_PASSWORD MFA_BOOTSTRAP_CONFIRM MFA_BOOTSTRAP_TOKEN
    ```

The bootstrap script refuses to run when MFA is enabled. Issuance clears outstanding challenges and recovery remnants, resets lockout state, and revokes active sessions as `mfa_bootstrap_issued`.

## Creating the owner

`npm run admin:create` creates the owner or rotates the existing owner's password.

- Creating or reactivating an MFA-disabled owner requires `MFA_BOOTSTRAP_TOKEN` and stores only its digest and expiry.
- Rotating the password of an already MFA-enabled owner preserves the factor and does not require a bootstrap token.
- Every invocation deletes outstanding MFA challenges and revokes active sessions as `password_changed`.

Run it only after the Phase 09 migration.

## Emergency MFA reset

Use reset only if both the authenticator and every recovery code are unavailable:

```bash
export ADMIN_EMAIL='owner@example.com'
read -s ADMIN_PASSWORD
export ADMIN_PASSWORD
export MFA_BOOTSTRAP_TOKEN="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"
export MFA_RESET_CONFIRM="RESET-MFA-${ADMIN_EMAIL}"
npm run admin:mfa-reset
```

The command verifies the password, deletes challenges and recovery codes, clears the factor and replay counter, stores only the fresh bootstrap digest and expiry, clears lockout, and revokes every session as `mfa_reset`. The next login must still present the bootstrap token. Clear every ephemeral shell value immediately after enrollment.

## Rollback and failure handling

The migration is additive but deliberately invalidates pre-MFA sessions. Rolling the application back to Phase 08 after migration is unsafe because old code tries to create sessions without `mfa_verified_at`; the new database constraint rejects those writes.

Preferred incident response:

1. Keep `/admin` unavailable if authentication integrity is uncertain.
2. Preserve the database backup and relevant platform logs.
3. Fix forward or redeploy the last verified Phase 09 image.
4. Use controlled reset only when the factor is genuinely unrecoverable.
5. Do not run migration `down` merely to restore password-only access.

A full schema rollback is acceptable only after an explicit decision to remove MFA and after revoking all sessions and recovery material. Treat the resulting password-only admin as temporarily unsafe.

## Verification inventory

Unit tests cover RFC 6238 output, TOTP replay, AES-GCM context binding, recovery codes, bootstrap parsing and one-time use, enrollment, challenge caps and cleanup, lockout, password-change invalidation, session checks, login timing, environment policy, migration intent, and Vercel headers.

The PostgreSQL E2E test performs a real bootstrap, first enrollment, recovery-code login, refresh rotation, replay-family containment, logout, logout-all, and migrated-constraint exercise.

Run locally:

```bash
npm run lint
npm run build
npm run test:security-headers

cd backend
npm run lint
npm run test
npm run test:coverage
npm run build
```

Run migration and E2E only against a disposable database:

```bash
cd backend
npm run db:migrate
npm run test:e2e
```

GitHub CI supplies an ephemeral PostgreSQL 18 service for migration and E2E verification.

## Explicit non-goals

Phase 09 does not claim to provide passkeys/WebAuthn, email-based MFA recovery, append-only audit events, security alert emails, online encryption-key rotation, a second administrator, or the final inventory and sales dashboard. Those remain later phases so each security boundary, migration, and rollback path remains independently reviewable.
