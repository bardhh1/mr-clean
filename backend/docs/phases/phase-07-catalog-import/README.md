# Phase 07 — Verified PDF catalog import

## Outcome

The July 2025 Mr. Clean PDF catalog is represented as a reproducible database release:

- 52 active products with codes `0001` through `0052`.
- Seven operational categories.
- EUR prices stored as integer cents.
- Package sizes and sale units preserved in Albanian.
- One real catalog image for every product.
- The six original demonstration records deactivated without deleting historical references.

## Source audit

The source is `katallogi mr clean1.pdf`, a 13-page landscape A4 catalog created in Adobe Illustrator. Pages 1 and 13 are covers; products appear on pages 2 through 12.

Every page is stored as one flattened 3508 × 2480 raster image. The PDF contains no extractable text layer, form fields, or JavaScript. Product names, dimensions, packaging and prices were therefore transcribed from rendered pages and checked visually rather than accepted from OCR.

Three ambiguities were handled conservatively:

1. Page 4 omits visible item codes. Codes `0007` through `0010` follow directly from page 3 ending at `0006` and page 5 starting at `0011`.
2. Items `0015` and `0016` share one caption. Their labels identify the Ocean and Fresh variants, both at 5L and EUR 8.00.
3. Item `0052` does not state a volume, so its unit is recorded only as `sprej`. No package size was invented.

## Category model

| Category | Product count | Catalog scope |
| --- | ---: | --- |
| Peceta dhe letër | 14 | `0001`–`0014` |
| Kimikate pastrimi | 24 | Hand care, floors, dishes, surfaces and disinfectants |
| Lavanderi | 2 | `0033`–`0034` |
| Hotelieri | 3 | `0039`–`0041` |
| Aroma dhe aparate | 2 | `0042`, `0051` |
| Shporta mbeturinash | 6 | `0045`–`0050` |
| Kontroll insektesh | 1 | `0052` |

These groupings follow product purpose instead of page count. They keep customer filtering useful while avoiding dozens of one-product categories.

## Product image extraction

`tools/extract-catalog-products.py` reads the single raster image from each PDF page and applies reviewed crop boxes at the native page resolution. It writes 52 WebP files under `public/catalog-products/`.

The extractor deliberately retains the catalog's blue background. Removing it with automatic generative or color-key techniques could alter bottle labels, colors, package edges, or other product evidence. The resulting assets are exact crops of the supplied catalog rather than recreated product renders.

Example command:

```bash
python3 tools/extract-catalog-products.py \
  "/path/to/katallogi mr clean1.pdf" \
  public/catalog-products
```

## Schema and migration

Migration `1787356803000-catalog-2025.ts` adds nullable `products.catalog_code` with:

- A four-digit format constraint.
- A unique index.
- API/entity support.
- Admin create/update validation.

The migration then:

1. Adds the three missing categories and normalizes all seven category positions.
2. Deactivates uncoded placeholder products instead of deleting them.
3. Imports or updates all 52 coded products.
4. Forces EUR currency, active stock, non-quote pricing and reviewed image paths.
5. Marks exactly three representative products as featured for the homepage.

The import uses a single JSON recordset inside the migration. Catalog code is the conflict key, so a repeated import updates the correct product instead of creating duplicates.

The down migration removes the 52 imported records, restores the original six active products, removes newly introduced empty categories and drops the catalog-code column.

## Frontend behavior

- Cards and detail pages show the catalog code beside stock status.
- Products sort by featured state and then catalog code.
- Detail-page category metadata comes from the API relationship.
- Related products now come from the same category.
- The existing cart remains versioned and reconciles saved items against current API products and prices.

## Verification

The catalog test asserts:

- Exactly 52 sequential codes.
- Unique slugs and image paths.
- Valid nonzero prices and units.
- Only the seven reviewed category slugs.
- A real extracted image exists for every record.
- Representative source prices remain exact, including EUR 10.50, EUR 50.00 and EUR 1.20.

Release gates:

```bash
npm run lint
npm run build

cd backend
npm run lint
npm run test
npm run build
```

Production deployment must run the migration through Railway's pre-deploy command, pass database readiness, return seven active categories and 52 active products, and serve every extracted image from Vercel before the release is accepted.
