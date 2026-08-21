import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CatalogQueryDto } from "./dto/catalog-query.dto";
import { CategoryEntity } from "./entities/category.entity";
import { ProductEntity } from "./entities/product.entity";

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categories: Repository<CategoryEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>
  ) {}

  listCategories(): Promise<CategoryEntity[]> {
    return this.categories.find({
      where: { is_active: true },
      order: { sort_order: "ASC", name: "ASC" }
    });
  }

  async getCategoryBySlug(slug: string): Promise<CategoryEntity> {
    const category = await this.categories.findOne({
      where: { slug, is_active: true }
    });

    if (!category) throw new NotFoundException("Category was not found");
    return category;
  }

  async listProducts(query: CatalogQueryDto) {
    const builder = this.products
      .createQueryBuilder("product")
      .innerJoinAndSelect("product.category", "category")
      .where("product.is_active = :active", { active: true })
      .andWhere("category.is_active = :categoryActive", { categoryActive: true });

    if (query.category) {
      builder.andWhere("category.slug = :categorySlug", {
        categorySlug: query.category
      });
    }

    if (query.featured) {
      builder.andWhere("product.is_featured = :featured", {
        featured: query.featured === "true"
      });
    }

    if (query.search) {
      builder.andWhere(
        "(product.name ILIKE :search OR product.description ILIKE :search)",
        { search: `%${query.search}%` }
      );
    }

    builder
      .orderBy("product.is_featured", "DESC")
      .addOrderBy("product.name", "ASC")
      .skip(query.offset)
      .take(query.limit);

    const [data, total] = await builder.getManyAndCount();
    return {
      data,
      meta: {
        total,
        limit: query.limit,
        offset: query.offset,
        has_more: query.offset + data.length < total
      }
    };
  }

  async getProductBySlug(slug: string): Promise<ProductEntity> {
    const product = await this.products
      .createQueryBuilder("product")
      .innerJoinAndSelect("product.category", "category")
      .where("product.slug = :slug", { slug })
      .andWhere("product.is_active = :active", { active: true })
      .andWhere("category.is_active = :categoryActive", { categoryActive: true })
      .getOne();

    if (!product) throw new NotFoundException("Product was not found");
    return product;
  }
}
