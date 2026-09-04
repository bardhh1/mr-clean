# Phase 09 — Mandatory administrator MFA and recovery

## Outcome

The sole Mr. Clean administrator can no longer obtain a session with a password alone. Every login now ends in one of two MFA paths:

1. An owner without an enrolled factor must bind an authenticator-app TOTP secret and verify it.
2. An enrolled owner must present a fresh TOTP or one unused recovery code.

The password step creates only a short-lived, one-time database challenge. Session cookies are issued only after that challenge is consumed successfully. This phase also invalidates all pre-MFA sessions, upgrades access tokens to version 3, and gives the owner an intentionally difficult emergency reset runbook.

This is the security foundation for the later dashboard. It does not treat the React interface, a client header, or possession of an old cookie as proof that MFA happened.

## Why it matters for this project

The dashboard will control prices, products, stock, orders, customer details, and eventually sales reporting. A stolen or reused password would therefore affect both business operations and customer data. Requiring a separate authenticator factor materially limits that failure mode.

The project has exactly one administrator, which changes the recovery design. There is no second administrator who can approve a reset, so recovery must avoid both extremes:

- Recovery cannot be so easy that an attacker can bypass MFA through email or support impersonation.
- Recovery cannot be impossible when the owner loses the authenticator device.

The selected approach is ten high-entropy, single-use recovery codes plus an operator-only Railway reset command that also requires the current password and an explicit confirmation phrase. Email is deliberately not an authentication recovery factor.

## Standards and security decisions

- TOTP follows [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238) with HMAC-SHA-1, six digits, and a 30-second period for broad authenticator compatibility.
- Validation accepts the current counter plus one adjacent counter in either direction for bounded clock drift.
- A successfully accepted TOTP counter is stored and cannot be accepted again. NIST requires a time-based OTP to be accepted only once during its validity period.
- Every MFA challenge allows at most `MFA_MAX_ATTEMPTS` failures and expires after `MFA_CHALLENGE_TTL_SECONDS`.
- Password, TOTP, recovery-code, and recovery-code-regeneration failures share the serialized owner-level `ADMIN_MAX_FAILED_LOGINS` budget. Creating a fresh challenge cannot reset that budget or bypass `ADMIN_LOCKOUT_MINUTES`.
- The implementation follows the [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html) by requiring MFA for privileged access, supplying single-use recovery codes, and requiring a current enrolled factor before recovery-code replacement.
- This TOTP design is not phishing-resistant. Passkeys/WebAuthn remain the preferred future upgrade if the owner wants stronger assurance.

## Authentication flow

### Password step

`POST /api/v1/admin/auth/login` still performs the constant-shape password verification, owner lockout, and pessimistic owner-row lock from Phase 08. It no longer creates an admin session.

On success, it:

1. Preserves the account-wide failure budget until MFA succeeds (while clearing a fully expired lockout window).
2. Invalidates any earlier unfinished MFA challenge for the owner.
3. Creates a random 256-bit opaque challenge secret.
4. Stores only its SHA-256 digest.
5. Binds the challenge to the current `password_changed_at` value.
6. Returns a five-minute challenge token and either `enroll` or `verify` mode.

Changing the password after challenge creation makes the challenge unusable. Starting another login also consumes the previous challenge, so only the newest password verification can proceed.

### First-time enrollment

For an owner without MFA, the login response contains an RFC-compatible `otpauth://` URI and its manual Base32 secret. The pending server copy is encrypted before it reaches PostgreSQL.

`POST /api/v1/admin/auth/mfa/verify` validates the first TOTP inside a database transaction. A successful transaction:

- Re-encrypts the secret using an owner-specific authenticated-encryption context.
- Marks MFA enabled and records the enrollment time.
- Stores the accepted TOTP counter to prevent replay.
- Replaces all recovery codes with ten new 80-bit codes and stores only keyed HMAC-SHA-256 digests.
- Consumes the challenge.
- Creates the first MFA-verified session.
- Returns the plaintext recovery codes exactly once.

If the response containing recovery codes is lost, the owner must use the emergency reset procedure and enroll again. The API cannot reconstruct plaintext recovery codes from their hashes.

### Later logins

An enrolled login challenge accepts either:

- A fresh six-digit TOTP whose counter is newer than the last accepted counter.
- One unused recovery code.

Recovery-code lookup and consumption occur under the same owner transaction as session creation. Concurrent requests therefore cannot spend the same code twice. A recovery-code login is reported in the response so the UI can warn the owner to replace the remaining set.

Authentication responses that contain enrollment material, recovery codes, session metadata, or cookie rotations explicitly send `Cache-Control: no-store`.

### Recovery-code replacement

`POST /api/v1/admin/auth/mfa/recovery-codes` requires:

- A currently active MFA-backed session.
- The trusted browser request-shape guard.
- A fresh TOTP that has not already been accepted.
- A strict three-requests-per-minute endpoint throttle.

All old recovery codes are deleted in the transaction before ten replacements are returned once. An active cookie alone is not sufficient to rotate the recovery path.

## Cryptographic storage

### TOTP secrets

TOTP requires the server to reproduce authenticator outputs, so its shared secret cannot be one-way hashed. The secret is encrypted with AES-256-GCM:

- A new 96-bit IV is generated for every encryption.
- The authentication tag detects modification.
- Associated data binds an enrollment secret to its challenge ID and an enrolled secret to its owner ID.
- The envelope is versioned as `v1` so a later key-rotation format can coexist with stored records.
- `MFA_ENCRYPTION_KEY` must be the strict, unpadded 43-character Base64URL encoding of exactly 32 bytes.

The key must remain in Railway variables and in the owner's secure backup. Losing it makes existing authenticators unusable and requires the emergency reset flow.

### Recovery codes

Each recovery code contains 80 random bits, encoded as four groups of four Base32 characters. PostgreSQL stores an HMAC-SHA-256 digest keyed by `MFA_RECOVERY_PEPPER`, never the code itself. The pepper must be stored separately from the database in Railway variables.

### MFA challenges

The browser receives `<challenge-uuid>.<random-secret>`. PostgreSQL stores only the digest of the random secret. Challenges are one-time, short-lived, attempt-bounded, bound to the password version, and serialized on the sole owner row. Failed factor checks also increment the owner-level failure count under that row lock, so replacing a challenge does not create a new brute-force budget.

## Database changes

Migration `1788480000000-admin-mfa-foundation.ts` adds:

### `admin_users`

- `mfa_enabled`
- `mfa_secret_ciphertext`
- `mfa_enrolled_at`
- `last_totp_counter`
- A check constraint that prevents contradictory enabled/secret/enrollment state.

### `admin_sessions`

- `mfa_verified_at`
- New revocation reasons: `mfa_enrollment_required` and `mfa_reset`.

Every active session is revoked as `mfa_enrollment_required` during migration. The guard also rejects a session without `mfa_verified_at` or an owner without enabled MFA, giving defense in depth during and after deployment.

### `admin_mfa_challenges`

Stores the one-time password-to-MFA bridge, its purpose, secret digest, password version, expiry, failure count, consumption time, and encrypted pending enrollment secret. Database checks constrain purposes, attempts, and whether an enrollment secret is permitted.

### `admin_mfa_recovery_codes`

Stores owner-scoped recovery-code digests and one-time consumption timestamps. A unique owner/digest constraint and row locks prevent reuse.

## API contract

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/admin/auth/login` | Password + trusted client | Begin enrollment or MFA verification; never creates a session. |
| `POST` | `/api/v1/admin/auth/mfa/verify` | One-time challenge + TOTP/recovery code + trusted client | Consume the MFA challenge and create a session. |
| `POST` | `/api/v1/admin/auth/mfa/recovery-codes` | Active session + fresh TOTP + trusted client | Replace every recovery code. |
| `POST` | `/api/v1/admin/auth/refresh` | MFA-backed refresh cookie + trusted client | Rotate the existing MFA-backed family. |

## Frontend behavior

The `/admin` route now has four explicit states:

1. Password sign-in.
2. First-time authenticator enrollment or normal MFA verification.
3. One-time recovery-code display after enrollment.
4. Authenticated administration.

The enrollment screen supports the `otpauth://` link and manual secret entry. The secret is never stored in browser persistence. Recovery codes remain only in component memory until the owner confirms they were saved.

## Environment contract

Required before the Phase 09 image starts:

```dotenv
MFA_ENCRYPTION_KEY=<32 random bytes encoded as Base64URL>
MFA_RECOVERY_PEPPER=<at least 32 random characters>
MFA_ISSUER=Mr. Clean Admin
MFA_CHALLENGE_TTL_SECONDS=300
MFA_MAX_ATTEMPTS=5
```

Generate independent values in a trusted terminal. Do not commit or paste the resulting values into documentation, chat, or build logs:

```bash
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
openssl rand -base64 48
```

Do not reuse `JWT_ACCESS_SECRET` as either MFA value. Separation makes later rotation and incident response less destructive.

## Deployment sequence

Phase 08 must be deployed and its login/session/logout-all smoke test must pass before Phase 09 is merged for production.

1. Enable and verify a Railway PostgreSQL backup or snapshot.
2. Store `MFA_ENCRYPTION_KEY` and `MFA_RECOVERY_PEPPER` in the API service variables.
3. Store the three explicit policy values shown above.
4. Confirm the owner knows the current password and has an authenticator app ready.
5. Deploy the Phase 09 candidate. Railway's pre-deploy command runs the migration.
6. Confirm readiness before traffic switches.
7. Confirm the next admin password login returns `mode: enroll` and no session cookies.
8. Enroll, verify the first TOTP, and store all recovery codes offline.
9. Verify `/admin/auth/me`, session listing, refresh rotation, logout, and a second password-plus-TOTP login.
10. Verify one recovery code can log in once and is rejected when replayed.

Never expose a real TOTP secret, recovery code, password, cookie, encryption key, or pepper during production verification.

## Emergency MFA reset

If the owner loses both the authenticator and every recovery code, run only from a trusted Railway shell or similarly controlled environment:

```bash
ADMIN_EMAIL=owner@example.com \
ADMIN_PASSWORD='current-password' \
MFA_RESET_CONFIRM='RESET-MFA-owner@example.com' \
npm run admin:mfa-reset
```

The command verifies the active owner's current password, deletes challenges and recovery codes, clears the encrypted factor and account lockout state, and revokes every session with `mfa_reset`. The next login forces complete enrollment and produces a new recovery set.

Do not store `ADMIN_PASSWORD` or `MFA_RESET_CONFIRM` as persistent Railway variables. Remove them from the shell environment and terminal history according to the operator's platform after use.

## Rollback

The migration is additive, but it deliberately revokes all earlier sessions. Rolling the application back to Phase 08 after the migration would restore password-only session creation, which is a security regression.

Preferred response to a Phase 09 application problem:

1. Keep the admin surface unavailable to the public if authentication cannot be trusted.
2. Preserve a database backup and logs.
3. Fix forward or redeploy the last verified Phase 09 image.
4. Do not run the migration `down` merely to restore access.

A full schema rollback is permitted only before the dashboard contains meaningful operational data or after an explicit decision to remove MFA. Revoke all sessions and recovery material first, and treat the restored password-only admin as temporarily unsafe.

## Verification

### CI dependency-gate remediation

The first branch CI run passed frontend/backend lint, builds, and backend unit coverage, then correctly stopped before E2E because both dependency-audit jobs found existing high-severity transitive advisories on the default branch. Phase 09 applies the exact lockfile-only Dependabot updates rather than weakening or bypassing the audit gate:

- Frontend `browserslist` is resolved from `4.28.4` to `4.28.8`, including its compatible browser-data transitive updates. The release fixes prototype-write and unbounded-memory behavior in its query parser.
- Backend `qs` is resolved from `6.15.3` to `6.16.0`. The release adds bounded stringify recursion and parser limit fixes.

Neither application manifest changes its direct dependency contract. The full lint, test, coverage, build, audit, migration, and PostgreSQL E2E pipeline must pass again on the resulting lockfiles; the failed run is retained as evidence that the gate blocks vulnerable dependency snapshots.

Unit coverage now exercises:

- The RFC 6238 vector and six-digit truncation.
- TOTP replay prevention.
- AES-GCM authenticated encryption and context binding.
- Recovery-code formatting, normalization, and keyed hashing.
- Enrollment, one-time recovery-code disclosure, and session creation.
- Attempt exhaustion and challenge consumption.
- Owner-level MFA lockout that cannot be reset by issuing a fresh challenge.
- Recovery-code replay rejection.
- Password-change invalidation of an outstanding challenge.
- Migration security intent and environment-key validation.

The PostgreSQL E2E suite additionally exercises real first-time enrollment, recovery-code login, refresh rotation, replay-family containment, logout, logout-all, and migrated constraints.

Run locally where applicable and in CI:

```bash
cd backend
npm run lint
npm run test
npm run test:coverage
npm run build
npm run db:migrate
npm run test:e2e
```

The last two commands require the ephemeral PostgreSQL service used by CI or an equivalent disposable database.

## Explicit non-goals

This phase does not claim to provide:

- Phishing-resistant passkeys/WebAuthn.
- Email-based MFA or email-based MFA recovery.
- General CSRF/Origin/CSP hardening.
- Append-only audit events or security alert emails.
- Automatic cleanup of expired challenge history.
- Online encryption-key rotation.
- Cash-on-delivery order changes, inventory, metrics, or the final dashboard UI.

Those controls remain separate so their deployment and rollback behavior stays reviewable. Phase 10 should add the browser/API boundary and append-only security audit trail before the commerce and dashboard phases.
