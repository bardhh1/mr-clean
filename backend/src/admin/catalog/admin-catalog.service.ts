import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, QueryFailedError, Repository } from "typeorm";
import { AuditService, type AuditContext } from "../../audit/audit.service";
import { CategoryEntity } from "../../catalog/entities/category.entity";
import { ProductEntity } from "../../catalog/entities/product.entity";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Injectable()
export class AdminCatalogService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categories: Repository<CategoryEntity>,
    @InjectRepository(ProductEntity)
    private readonly products: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService
  ) {}

  listCategories(): Promise<CategoryEntity[]> {
    return this.categories.find({ order: { sort_order: "ASC", name: "ASC" } });
  }

  listProducts(): Promise<ProductEntity[]> {
    return this.products.find({
      relations: { category: true },
      order: { catalog_code: "ASC", name: "ASC" }
    });
  }

  async createCategory(input: CreateCategoryDto, context: AuditContext): Promise<CategoryEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(CategoryEntity);
      const entity = repository.create({
        name: input.name.trim(),
        slug: input.slug ?? slugify(input.name),
        description: input.description?.trim() || null,
        sort_order: input.sort_order ?? 99,
        is_active: input.is_active ?? true
      });
      const saved = await this.saveCategory(repository, entity);
      await this.audit.record({
        ...context,
        action: "catalog.category.created",
        targetType: "category",
        targetId: saved.id,
        metadata: { slug: saved.slug }
      }, manager);
      return saved;
    });
  }

  async updateCategory(id: string, input: UpdateCategoryDto, context: AuditContext): Promise<CategoryEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(CategoryEntity);
      const entity = await repository.findOneBy({ id });
      if (!entity) throw new NotFoundException("Category was not found");

      repository.merge(entity, {
        ...input,
        name: input.name?.trim(),
        description: input.description?.trim() || (input.description === "" ? null : undefined)
      });
      const saved = await this.saveCategory(repository, entity);
      await this.audit.record({
        ...context,
        action: "catalog.category.updated",
        targetType: "category",
        targetId: saved.id,
        metadata: { changed_fields: Object.keys(input).sort() }
      }, manager);
      return saved;
    });
  }

  async deleteCategory(id: string, context: AuditContext): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(CategoryEntity);
      try {
        const result = await repository.delete(id);
        if (!result.affected) throw new NotFoundException("Category was not found");
        await this.audit.record({
          ...context,
          action: "catalog.category.deleted",
          targetType: "category",
          targetId: id
        }, manager);
      } catch (error) {
        if (databaseCode(error) === "23503") {
          throw new ConflictException("Category still contains products");
        }
        throw error;
      }
    });
  }

  async createProduct(input: CreateProductDto, context: AuditContext): Promise<ProductEntity> {
    return this.dataSource.transaction(async (manager) => {
      const categories = manager.getRepository(CategoryEntity);
      const products = manager.getRepository(ProductEntity);
      await this.requireCategory(categories, input.category_id);
      const entity = products.create({
        ...input,
        catalog_code: input.catalog_code?.trim() || null,
        name: input.name.trim(),
        slug: input.slug ?? slugify(input.name),
        description: input.description.trim(),
        currency: "EUR",
        image_urls: input.image_urls ?? [],
        image_keys: input.image_keys ?? [],
        is_active: input.is_active ?? true,
        is_featured: input.is_featured ?? false,
        requires_quote: input.requires_quote ?? false,
        stock_label: input.stock_label?.trim() || "Në stok"
      });
      const saved = await this.saveProduct(products, entity);
      await this.audit.record({
        ...context,
        action: "catalog.product.created",
        targetType: "product",
        targetId: saved.id,
        metadata: { catalog_code: saved.catalog_code, slug: saved.slug }
      }, manager);
      return saved;
    });
  }

  async updateProduct(id: string, input: UpdateProductDto, context: AuditContext): Promise<ProductEntity> {
    return this.dataSource.transaction(async (manager) => {
      const categories = manager.getRepository(CategoryEntity);
      const products = manager.getRepository(ProductEntity);
      const entity = await products.findOneBy({ id });
      if (!entity) throw new NotFoundException("Product was not found");
      if (input.category_id && input.category_id !== entity.category_id) {
        await this.requireCategory(categories, input.category_id);
      }

      products.merge(entity, {
        ...input,
        catalog_code: input.catalog_code?.trim() || (input.catalog_code === "" ? null : undefined),
        name: input.name?.trim(),
        description: input.description?.trim(),
        stock_label: input.stock_label?.trim()
      });
      const saved = await this.saveProduct(products, entity);
      await this.audit.record({
        ...context,
        action: "catalog.product.updated",
        targetType: "product",
        targetId: saved.id,
        metadata: { changed_fields: Object.keys(input).sort() }
      }, manager);
      return saved;
    });
  }

  async deleteProduct(id: string, context: AuditContext): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(ProductEntity).delete(id);
      if (!result.affected) throw new NotFoundException("Product was not found");
      await this.audit.record({
        ...context,
        action: "catalog.product.deleted",
        targetType: "product",
        targetId: id
      }, manager);
    });
  }

  private async requireCategory(repository: Repository<CategoryEntity>, id: string): Promise<void> {
    if (!await repository.existsBy({ id })) {
      throw new NotFoundException("Category was not found");
    }
  }

  private async saveCategory(repository: Repository<CategoryEntity>, entity: CategoryEntity): Promise<CategoryEntity> {
    try {
      return await repository.save(entity);
    } catch (error) {
      if (databaseCode(error) === "23505") {
        throw new ConflictException("Category slug already exists");
      }
      throw error;
    }
  }

  private async saveProduct(repository: Repository<ProductEntity>, entity: ProductEntity): Promise<ProductEntity> {
    try {
      return await repository.save(entity);
    } catch (error) {
      if (databaseCode(error) === "23505") {
        throw new ConflictException("Product slug or catalog code already exists");
      }
      throw error;
    }
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function databaseCode(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  return (error.driverError as { code?: string }).code;
}
