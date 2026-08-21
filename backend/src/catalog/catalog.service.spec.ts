import type { Repository } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import { CatalogService } from "./catalog.service";
import { CategoryEntity } from "./entities/category.entity";
import { ProductEntity } from "./entities/product.entity";

function queryBuilderMock() {
  const builder = {
    innerJoinAndSelect: vi.fn(),
    where: vi.fn(),
    andWhere: vi.fn(),
    orderBy: vi.fn(),
    addOrderBy: vi.fn(),
    skip: vi.fn(),
    take: vi.fn(),
    getManyAndCount: vi.fn(),
    getOne: vi.fn()
  };

  for (const method of ["innerJoinAndSelect", "where", "andWhere", "orderBy", "addOrderBy", "skip", "take"] as const) {
    builder[method].mockReturnValue(builder);
  }

  return builder;
}

describe("CatalogService", () => {
  it("always limits public product results to active products and categories", async () => {
    const builder = queryBuilderMock();
    builder.getManyAndCount.mockResolvedValue([[{ id: "product-1" }], 1]);
    const productRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(builder)
    } as unknown as Repository<ProductEntity>;
    const service = new CatalogService({} as Repository<CategoryEntity>, productRepo);

    const result = await service.listProducts({
      category: "hotelieri",
      search: "shampo",
      featured: "true",
      limit: 12,
      offset: 0
    });

    expect(builder.where).toHaveBeenCalledWith("product.is_active = :active", { active: true });
    expect(builder.andWhere).toHaveBeenCalledWith(
      "category.is_active = :categoryActive",
      { categoryActive: true }
    );
    expect(builder.andWhere).toHaveBeenCalledWith("category.slug = :categorySlug", {
      categorySlug: "hotelieri"
    });
    expect(builder.take).toHaveBeenCalledWith(12);
    expect(result.meta).toEqual({ total: 1, limit: 12, offset: 0, has_more: false });
  });

  it("returns 404 semantics for inactive or missing product slugs", async () => {
    const builder = queryBuilderMock();
    builder.getOne.mockResolvedValue(null);
    const productRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(builder)
    } as unknown as Repository<ProductEntity>;
    const service = new CatalogService({} as Repository<CategoryEntity>, productRepo);

    await expect(service.getProductBySlug("hidden-product")).rejects.toMatchObject({
      status: 404
    });
  });
});
