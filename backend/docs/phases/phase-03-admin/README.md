# Phase 03 — Secure administration and Railway product storage

## Outcome

This phase creates the private management boundary for Mr. Clean. Authorized staff can sign in, manage categories and products, and upload product photography to a private Railway Bucket. Public catalog responses translate stored object keys into short-lived signed URLs, so the bucket never needs anonymous access.

The work is deliberately API-first. The existing admin screen is connected to these endpoints in Phase 05; no browser is allowed to write directly to PostgreSQL or object storage.

## Database additions

### Admin users

`admin_users` contains a normalized, case-insensitive email identity, a salted password verifier, an active flag, a constrained role, the latest login time, and audit timestamps. Passwords are encoded with Node's built-in scrypt implementation using a random 16-byte salt, a 64-byte derived key, and fixed work parameters.

The password verifier is never returned by a controller. Disabling a user immediately invalidates access checks even when an access token has time remaining.

### Refresh sessions

`admin_sessions` contains one refresh session per login or rotation:

- A UUID session identifier.
- A SHA-256 digest of the random refresh secret, never the raw token.
- Expiry, revocation, last-use, and creation timestamps.
- A cascading foreign key to its admin user.

Indexes cover active-session lookup and user-session administration. The migration also enforces the currently supported `admin` role at the database layer.

## Authentication design

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/admin/auth/login` | Verify credentials and create a session. |
| `POST` | `/api/v1/admin/auth/refresh` | Rotate the refresh session and issue new cookies. |
| `POST` | `/api/v1/admin/auth/logout` | Revoke the refresh session and clear both cookies. |
| `GET` | `/api/v1/admin/auth/me` | Return the authenticated admin identity. |

The browser receives two `HttpOnly` cookies:

1. A short-lived signed JWT access cookie. Its payload includes the user and session IDs, and every privileged request confirms that session against PostgreSQL. Revocation therefore takes effect immediately.
2. A longer-lived opaque refresh cookie in the form `<session-id>.<random-secret>`. Only the digest is stored. Refresh uses a pessimistic database lock, revokes the old row, and creates a replacement in one transaction, preventing concurrent reuse from creating multiple valid descendants.

Production uses `Secure; SameSite=None` because the Vercel storefront and Railway API are different sites. Local development uses `SameSite=Lax` without `Secure`. The refresh-cookie path is derived from `API_PREFIX`, so route versioning cannot silently break rotation or logout.

Login and refresh use tighter rate limits than the global API ceiling. Authentication and mutating admin requests also require the stable `x-mr-clean-client: mr-clean-web-v1` header. That header is not a secret and is not a replacement for authentication; it narrows accidental cross-origin form traffic while CORS and cookies provide the primary browser boundary.

## Catalog administration

All routes below require an active admin session and the trusted-client header.

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/v1/admin/categories` | Return active and inactive categories. |
| `POST` | `/api/v1/admin/categories` | Create a validated category and derive a slug when omitted. |
| `PATCH` | `/api/v1/admin/categories/:id` | Partially update a category. |
| `DELETE` | `/api/v1/admin/categories/:id` | Delete an empty category. |
| `GET` | `/api/v1/admin/products` | Return active and inactive products with categories. |
| `POST` | `/api/v1/admin/products` | Create a product after validating its category. |
| `PATCH` | `/api/v1/admin/products/:id` | Update content, price, category, images, and visibility. |
| `DELETE` | `/api/v1/admin/products/:id` | Delete a product. |

DTOs enforce length, type, UUID, integer-cent price, URL, and image-key constraints. Duplicate slugs return `409`, missing records return `404`, and a category containing products cannot be deleted. These explicit responses let the admin interface explain the corrective action instead of showing a generic failure.

## Railway Bucket uploads

| Method | Path | Behavior |
| --- | --- | --- |
| `POST` | `/api/v1/admin/uploads/product-images` | Upload one PNG, JPEG, or WebP image up to 5 MB. |
| `DELETE` | `/api/v1/admin/uploads/product-images?key=products/...` | Delete one object owned by the product namespace. |

The API talks to Railway's S3-compatible endpoint with service-injected credentials. Uploads are assigned random keys under `products/`; client filenames can never choose an object path. MIME type and size are checked before upload, and deletion rejects keys outside that namespace.

Products store immutable object keys rather than expiring URLs. Public catalog responses sign those keys for 15 minutes and combine them with any existing static image URLs. This keeps the bucket private while allowing the storefront to render current images. It also prevents expired URLs from being persisted in PostgreSQL.

## Creating the first administrator

Build the API and run the idempotent provisioning command with temporary environment values:

```bash
npm run build
ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='use-a-long-unique-password' npm run admin:create
```

The command creates the identity when missing or replaces its password and reactivates it when it already exists. The production run should happen from a Railway shell or one-off command so it uses the private database connection. `ADMIN_PASSWORD` is intentionally not part of persistent application configuration.

## Railway variables introduced

The API expects Railway Bucket credentials through:

- `AWS_ENDPOINT_URL`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET_NAME`
- `AWS_DEFAULT_REGION=auto`
- `AWS_S3_URL_STYLE=virtual`

It also requires `JWT_ACCESS_SECRET`, refresh/access lifetimes, and production cookie policy. Startup validation rejects missing or malformed values before traffic is accepted.

## Verification performed

Run from `backend/`:

```bash
npm run lint
npm run test
npm run build
```

Focused tests cover salted password verification, malformed-verifier rejection, trusted-client enforcement, and the public catalog's private-image resolution contract. Live login, upload, signed-image, and logout checks are completed against the deployed Railway resources in Phase 06.

## Why this matters

This phase separates public browsing from privileged business operations. PostgreSQL remains the source of truth, the API becomes the only mutation path, refresh tokens can be revoked and rotated, and product media stays private by default. The later admin UI can therefore remain a replaceable client instead of becoming an authorization or data-integrity boundary.

## What this enables next

Phase 04 adds transactional customer orders and protected order management. It can reuse the same admin session, request validation, PostgreSQL transaction boundary, and error contract established here.
