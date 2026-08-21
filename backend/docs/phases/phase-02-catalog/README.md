# Phase 02 — PostgreSQL catalog and public APIs

## Outcome

This phase moves the accepted storefront catalog into Railway PostgreSQL and exposes a read-only public API. The database now owns category and product truth; the Vite demo data remains only as a temporary availability fallback until frontend integration in Phase 05.

## Database model

### Categories

`categories` stores the storefront navigation taxonomy:

- UUID primary key generated in PostgreSQL.
- Unique stable slug for URLs and API filters.
- Albanian name and optional description.
- Explicit `sort_order` with a non-negative constraint.
- `is_active` visibility flag.
- Timezone-aware creation and update timestamps.

### Products

`products` stores sellable and quote-only catalog items:

- UUID primary key and required category foreign key.
- Unique stable slug.
- Description, exact integer-cent price, fixed EUR currency, and unit label.
- `image_urls` for existing frontend-hosted assets and `image_keys` for Railway Bucket objects introduced in Phase 03.
- Active, featured, quote-required, and stock-label merchandising fields.
- Timezone-aware creation and update timestamps.

Money remains integer cents because binary floating-point values are unsafe for totals. The currency constraint intentionally accepts only EUR, matching the current business and UI contract.

## Migration strategy

The first TypeORM migration:

1. Enables `pgcrypto` for UUID generation and `pg_trgm` for indexed fuzzy text lookup.
2. Creates both tables with named constraints.
3. Indexes the category foreign key because PostgreSQL does not create foreign-key indexes automatically.
4. Adds partial indexes that only contain active rows, matching the dominant public queries.
5. Adds GIN trigram indexes for `ILIKE` searches across product names and descriptions.
6. Seeds the four accepted categories and six accepted products using stable UUIDs and `ON CONFLICT DO NOTHING`.

The seed is part of the migration because a first production deployment must become useful atomically. The stable IDs also make integration and order fixtures deterministic. Future merchandising edits belong to admin APIs, not new seed migrations.

## Public endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/categories` | Active categories ordered for navigation. |
| `GET` | `/api/v1/categories/:slug` | One active category or `404`. |
| `GET` | `/api/v1/products` | Active product search, filters, and pagination. |
| `GET` | `/api/v1/products/:slug` | One active product with its active category or `404`. |

`GET /products` supports:

- `category=<slug>`
- `search=<1..80 characters>`
- `featured=true|false`
- `limit=<1..100>` with a default of 24
- `offset=<non-negative integer>`

The response includes `total`, `limit`, `offset`, and `has_more`. A bounded maximum prevents accidental or hostile requests from loading the entire catalog.

## Visibility and failure behavior

- Public queries always require both the product and its category to be active.
- Inactive records behave like missing records and return `404`; callers cannot use the endpoint to enumerate hidden inventory.
- Every query value is bound as a parameter. Search text is never interpolated into SQL.
- Unknown query fields are rejected by the global validation policy.
- Repository failures flow through the global exception filter and include a request ID.

## Why the relation is returned

Products include their category in API results. This removes extra category lookups for catalog cards, lets clients display category context consistently, and avoids a browser-side join that could combine stale category and product requests.

## Tests and verification

The catalog service tests prove that:

- Active-product and active-category predicates are always present.
- Category, featured, search, and pagination values are applied through the query builder.
- Missing or inactive product slugs result in `404` semantics.

Run from `backend/`:

```bash
npm run lint
npm run test
npm run build
```

The migration is executed against Railway PostgreSQL during the Phase 06 deployment. Railway's pre-deploy gate prevents the API release from becoming active if the schema cannot be applied.

## What this enables next

Phase 03 adds authenticated administration around the same entities, including category and product CRUD, session rotation, product visibility updates, and Railway Bucket uploads. The public controller remains read-only and does not share privileged routes.
