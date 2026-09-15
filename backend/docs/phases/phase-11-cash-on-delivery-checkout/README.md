# Phase 11 — Cash-on-delivery checkout

## Outcome

Phase 11 replaces the WhatsApp/bank-transfer checkout with a durable cash-on-delivery flow:

- Customer email is mandatory for every new checkout.
- Cash on delivery is the only accepted payment method.
- PostgreSQL calculates and stores the authoritative total from current product prices.
- Product name, unit, quantity, unit price, and line total are immutable order-item snapshots.
- The lifecycle is `pending → confirmed → processing → shipped → delivered`, with cancellation allowed before delivery.
- Customer and owner notification jobs enter a PostgreSQL outbox in the same transaction as the order or status change.
- A background worker sends through Resend with leases, bounded exponential retries, and deterministic idempotency keys.
- Production checkout requires a Cloudflare Turnstile token that the API verifies for the exact checkout action and canonical hostname before creating a new order.

The order API never waits for Resend. Provider downtime can delay a notification, but it cannot lose or roll back an accepted order.

## Transaction boundary

```text
POST /orders
  |
  `-- one PostgreSQL transaction
      |-- lock and validate catalog products
      |-- calculate total from database prices
      |-- insert order
      |-- insert immutable line snapshots
      `-- insert owner email job

commit -> return order receipt
             |
             `-- outbox worker claims and sends jobs independently
```

An idempotency retry with the same request returns the existing receipt. Reusing the key with different customer or cart data returns HTTP 409. Email jobs use unique business keys, so a committed order cannot enqueue duplicate creation notifications.

The browser never decides whether a challenge is valid. The API submits each new token directly to Cloudflare, requires `success=true`, `action=checkout`, and an allowlisted hostname, and fails closed if verification is unavailable. The challenge token is excluded from the order hash, so a legitimate idempotent retry does not need to redeem another token. The browser stores only a SHA-256 checkout signature and idempotency key in session storage, not raw customer details.

A public submission queues mail only to the configured owner. It cannot make the server send to its caller-selected customer address. Customer notification becomes reachable only when an authenticated, MFA-backed administrator moves the order from `pending` to `confirmed`; later lifecycle changes also notify the customer. This trusted approval boundary closes the arbitrary-recipient branded-email path while preserving the required customer and owner notifications.

After Turnstile verification, a PostgreSQL advisory transaction lock makes the application-wide checkout budget race-safe across Railway instances. Production accepts at most the configured number of new orders per hour and per customer address per day. This bounds owner-mail, database, and outbox amplification even when traffic is distributed across source IPs; the existing per-IP throttle remains an additional layer.

## Schema migration

Migration `1789516800000-cash-on-delivery-checkout.ts`:

1. Adds `customer_email`, `checkout_version`, and `legacy_payment_preference` to `orders`.
2. Preserves old payment data in `legacy_payment_preference` and maps the active payment field to `cash_on_delivery`.
3. Maps `pending_whatsapp` to `pending` and `completed` to `delivered`.
4. Adds database checks for payment, lifecycle, checkout version, and Phase 11 email presence.
5. Installs triggers that reject deletion or financial/snapshot mutation of orders and order items.
6. Creates `email_outbox` with constrained states, unique deduplication keys, leases, retry timestamps, provider IDs, and indexes for dispatch and order history.

Migrated Phase 4 orders use `checkout_version=1` and retain their original payment choice. New orders use `checkout_version=2`, require email, and have no legacy payment value.

The outbox deliberately has no foreign key to `orders`; notification evidence remains inspectable even if future retention workflows change order relationships. The application exposes no public or administrator endpoint that accepts email bodies, recipients, totals, or outbox states.

## Lifecycle

Allowed transitions are:

| Current | Allowed next states |
| --- | --- |
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `processing`, `cancelled` |
| `processing` | `shipped`, `cancelled` |
| `shipped` | `delivered`, `cancelled` |
| `delivered` | none |
| `cancelled` | none |

The order row is locked for each transition. The status change, Phase 10 audit event, and both status-notification jobs commit together. Repeating the current status is idempotent and creates no audit or email event.

## Email delivery behavior

The worker claims ready jobs with `FOR UPDATE SKIP LOCKED`, assigns a unique lease, and increments the attempt counter before sending. This supports multiple Railway instances without normal duplicate claims.

Each Resend request includes a deterministic `Idempotency-Key` and a completely snapshotted payload (`from`, recipient, reply-to, subject, text, and escaped HTML). Retry delays double from the configured base and cap at six hours. Network errors, timeouts, HTTP 408/429, concurrent-idempotency conflicts, and 5xx responses retry. Other 4xx responses are retained as terminal failures. Jobs that exhaust the configured attempt limit remain in `failed` state for investigation.

`sent` means Resend accepted the message and returned an ID; it does not prove inbox delivery. Delivery, bounce, complaint, and suppression webhooks are outside this phase and should be considered a later observability enhancement.

Resend retains API idempotency keys for 24 hours. The local outbox permanently records successful acceptance, while the provider key protects the crash window between remote acceptance and the local `sent` update. No external email system can provide an unlimited exactly-once guarantee; the implementation provides durable at-least-once processing with duplicate suppression across the expected recovery window.

Worker logs include only job ID, attempt, and outcome. They do not log API keys, email bodies, customer addresses, or recipients. HTML rendering escapes customer, address, note, and product snapshot content.

## Railway environment contract

Add these variables to the API service before deploying the migration:

```dotenv
EMAIL_DELIVERY_ENABLED=true
RESEND_API_KEY=<secret Resend server API key>
EMAIL_FROM=Mr. Clean <orders@verified-domain.example>
ORDER_OWNER_EMAIL=<client owner email>
EMAIL_OUTBOX_POLL_INTERVAL_MS=5000
EMAIL_OUTBOX_BATCH_SIZE=20
EMAIL_OUTBOX_MAX_ATTEMPTS=8
EMAIL_OUTBOX_BASE_RETRY_SECONDS=30
EMAIL_OUTBOX_LOCK_TIMEOUT_SECONDS=300
TURNSTILE_ENABLED=true
TURNSTILE_SECRET_KEY=<secret key from the production Turnstile widget>
TURNSTILE_EXPECTED_HOSTNAMES=www.mrclean-ks.com
ORDER_GLOBAL_LIMIT_PER_HOUR=60
ORDER_RECIPIENT_LIMIT_PER_DAY=3
```

Production startup and the pre-deploy migration validator reject disabled delivery, a missing/malformed Resend key, an invalid owner/sender address, out-of-range worker values, or a lease shorter than `batch size × 12 seconds`.

`EMAIL_FROM` must use a sender on a domain verified in Resend. Keep `RESEND_API_KEY` secret and server-only. Do not place real values in Git, tickets, screenshots, ordinary logs, or chat.

Set Railway `CORS_ORIGINS=https://www.mrclean-ks.com`; the apex domain redirects to this canonical `www` origin. Configure the matching public `VITE_TURNSTILE_SITE_KEY` in Vercel. Never put the Turnstile secret in Vercel or any `VITE_*` variable. The production Turnstile widget must allow `www.mrclean-ks.com` and use the managed challenge mode.

Local development and CI may use `EMAIL_DELIVERY_ENABLED=false`. Orders still enqueue messages, but no provider request is made. This makes the complete transaction contract testable without sending real email.

## Controlled rollout

This phase changes both sides of the checkout contract, so use a brief maintenance window instead of pretending the old and new forms are simultaneously compatible.

1. Complete the still-pending Phase 10 credential-bound production checks: login, TOTP, refresh, session list, logout-all, and re-login.
2. Verify a recent restorable PostgreSQL backup and record its identifier outside the repository.
3. Confirm the owner notification address and verify the production sending domain in Resend.
4. Create the Turnstile widget for `www.mrclean-ks.com`, add its public site key to Vercel, and add its secret plus the exact hostname to Railway.
5. Set Railway `CORS_ORIGINS=https://www.mrclean-ks.com` and add the remaining Phase 11 email variables. Do not expose either server key to Vercel or any `VITE_*` variable.
6. Put checkout into a short maintenance window or otherwise prevent submissions during the contract switch.
7. Deploy the Railway API. Its pre-deploy command validates variables and runs the migration before the new worker starts.
8. Verify API readiness, migration presence, outbox table checks, and worker startup logs.
9. Deploy the Vercel frontend and immediately remove the checkout maintenance window.
10. Place one controlled low-value production order using an inbox the team can inspect.
11. Confirm the Turnstile verification, server-calculated total, one owner creation job, owner email, and no WhatsApp redirect or pre-confirmation customer email.
12. Confirm the order and verify that the first customer email is created only by that authenticated transition; then advance through each remaining state and confirm audit and notification rows.
13. Cancel a separate test order and verify cancellation is terminal.

## Client owner handoff

Use `npm run admin:replace` only in a private production shell while the client is present and after taking a database backup. It requires the exact current owner email, the client's normalized email, a client-chosen 12–128 character password, a fresh 32-byte Base64URL MFA bootstrap token, and this explicit confirmation:

```text
REPLACE-ADMIN-<current-email>-WITH-<client-email>
```

The command runs in one database transaction. It deactivates the test owner, revokes every old and replacement session, deletes both identities' pending MFA challenges and recovery codes, resets any previous MFA factor on the replacement identity, hashes the new password, and activates exactly one owner. A mismatch or failure rolls the whole operation back.

Do not paste the password, bootstrap token, authenticator code, QR secret, recovery codes, or database URL into chat, Git, tickets, deployment variables, or retained logs. Let the client type the password privately. Immediately after replacement, the client signs in at `https://www.mrclean-ks.com/admin`, supplies the short-lived bootstrap token, scans the new QR code in an authenticator app, enters the current rotating six-digit code, and stores the generated recovery codes offline. Verify logout, password login, TOTP, session listing, logout-all, and re-login before ending the handoff. The six-digit code rotates; it is not a fixed password.

Do not merge or deploy until CI, migration testing, security review, and the production variables/domain are ready.

## Release verification

Before push:

```bash
npm run lint
npm run build
npm run test:security-headers

cd backend
npm run lint
npm run test:coverage
npm run build
```

CI then builds a fresh PostgreSQL 18 database, runs every migration, and executes end-to-end tests that verify:

- COD order creation and idempotency.
- Owner email job in the same committed order, with no public-path customer delivery.
- Customer and owner status jobs after an authenticated administrator confirms the order.
- Rejection of missing email and bank transfer.
- Database rejection of total and item-price mutation.
- Authenticated status changes and their two notification jobs.

Production verification must inspect outbox rows without printing bodies or addresses into retained logs. Count/status queries are preferred. A failed notification does not justify deleting or recreating its order.

## Rollback

Prefer forward fixes after the migration accepts Phase 11 orders. The down migration necessarily drops the outbox and customer-email column and collapses `processing`/`shipped` into `confirmed`; it is data-losing for Phase 11 metadata. Use it only with a verified backup and an explicit incident decision.

For an email-provider incident, keep the schema and API deployed, preserve the outbox, and temporarily stop the worker only as an emergency operational measure. Orders remain durable and pending jobs resume after delivery is safely re-enabled.
