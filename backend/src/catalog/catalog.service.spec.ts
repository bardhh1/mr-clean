import type { Repository } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CatalogService } from "./catalog.service";
import { CategoryEntity } from "./entities/category.entity";
import { ProductEntity } from "./entities/product.entity";
import type { StorageService } from "../storage/storage.service";

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
  const storage = {
    resolveProductImages: vi.fn().mockImplementation((urls: string[]) => Promise.resolve(urls))
  } as unknown as StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists active categories and applies missing-category semantics", async () => {
    const category = { id: "category-1", slug: "hotelieri" } as CategoryEntity;
    const categoryRepo = {
      find: vi.fn().mockResolvedValue([category]),
      findOne: vi.fn()
        .mockResolvedValueOnce(category)
        .mockResolvedValueOnce(null)
    } as unknown as Repository<CategoryEntity>;
    const service = new CatalogService(categoryRepo, {} as Repository<ProductEntity>, storage);

    await expect(service.listCategories()).resolves.toEqual([category]);
    await expect(service.getCategoryBySlug("hotelieri")).resolves.toBe(category);
    await expect(service.getCategoryBySlug("missing")).rejects.toMatchObject({ status: 404 });
  });

  it("always limits public product results to active products and categories", async () => {
    const builder = queryBuilderMock();
    builder.getManyAndCount.mockResolvedValue([[{ id: "product-1" }], 1]);
    const productRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(builder)
    } as unknown as Repository<ProductEntity>;
    const service = new CatalogService({} as Repository<CategoryEntity>, productRepo, storage);

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
    const service = new CatalogService({} as Repository<CategoryEntity>, productRepo, storage);

    await expect(service.getProductBySlug("hidden-product")).rejects.toMatchObject({
      status: 404
    });
  });

  it("supports false filters, pagination, and a successful product lookup", async () => {
    const product = {
      id: "product-2",
      slug: "leter-profesionale",
      image_urls: ["https://cdn.invalid/product.png"],
      image_keys: []
    } as unknown as ProductEntity;
    const builder = queryBuilderMock();
    builder.getManyAndCount.mockResolvedValue([[product], 2]);
    builder.getOne.mockResolvedValue(product);
    const productRepo = {
      createQueryBuilder: vi.fn().mockReturnValue(builder)
    } as unknown as Repository<ProductEntity>;
    const service = new CatalogService({} as Repository<CategoryEntity>, productRepo, storage);

    const page = await service.listProducts({ featured: "false", limit: 1, offset: 0 });

    expect(builder.andWhere).toHaveBeenCalledWith(
      "product.is_featured = :featured",
      { featured: false }
    );
    expect(page.meta.has_more).toBe(true);
    await expect(service.getProductBySlug(product.slug)).resolves.toMatchObject({
      id: product.id,
      image_urls: product.image_urls
    });
  });
});
