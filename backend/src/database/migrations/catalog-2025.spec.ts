import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogProducts } from "./1787356803000-catalog-2025";

describe("2025 PDF catalog data", () => {
  it("contains every sequential catalog product exactly once", () => {
    const expectedCodes = Array.from(
      { length: 52 },
      (_, index) => String(index + 1).padStart(4, "0")
    );
    expect(catalogProducts.map((product) => product.catalog_code)).toEqual(expectedCodes);
    expect(new Set(catalogProducts.map((product) => product.slug)).size).toBe(52);
    expect(new Set(catalogProducts.map((product) => product.image_url)).size).toBe(52);
  });

  it("uses valid prices, units, categories, and extracted image assets", () => {
    const categorySlugs = new Set([
      "peceta-leter",
      "kimikate-pastrimi",
      "lavanderi",
      "hotelieri",
      "aroma-aparate",
      "shporta-mbeturinash",
      "kontroll-insektesh"
    ]);

    for (const product of catalogProducts) {
      expect(product.price_cents).toBeGreaterThan(0);
      expect(product.unit.length).toBeGreaterThan(0);
      expect(categorySlugs.has(product.category_slug)).toBe(true);
      expect(existsSync(resolve(process.cwd(), "..", "public", product.image_url.slice(1)))).toBe(true);
    }
  });

  it("preserves representative prices from the source catalog", () => {
    const prices = Object.fromEntries(
      catalogProducts.map((product) => [product.catalog_code, product.price_cents])
    );
    expect(prices).toMatchObject({
      "0001": 1800,
      "0010": 1050,
      "0032": 5000,
      "0037": 120,
      "0052": 1400
    });
  });
});
