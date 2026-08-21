import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { QueryFailedError, Repository } from "typeorm";
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
    private readonly products: Repository<ProductEntity>
  ) {}

  listCategories(): Promise<CategoryEntity[]> {
    return this.categories.find({ order: { sort_order: "ASC", name: "ASC" } });
  }

  listProducts(): Promise<ProductEntity[]> {
    return this.products.find({
      relations: { category: true },
      order: { name: "ASC" }
    });
  }

  async createCategory(input: CreateCategoryDto): Promise<CategoryEntity> {
    const entity = this.categories.create({
      name: input.name.trim(),
      slug: input.slug ?? slugify(input.name),
      description: input.description?.trim() || null,
      sort_order: input.sort_order ?? 99,
      is_active: input.is_active ?? true
    });
    return this.saveCategory(entity);
  }

  async updateCategory(id: string, input: UpdateCategoryDto): Promise<CategoryEntity> {
    const entity = await this.categories.findOneBy({ id });
    if (!entity) throw new NotFoundException("Category was not found");

    this.categories.merge(entity, {
      ...input,
      name: input.name?.trim(),
      description: input.description?.trim() || (input.description === "" ? null : undefined)
    });
    return this.saveCategory(entity);
  }

  async deleteCategory(id: string): Promise<void> {
    try {
      const result = await this.categories.delete(id);
      if (!result.affected) throw new NotFoundException("Category was not found");
    } catch (error) {
      if (databaseCode(error) === "23503") {
        throw new ConflictException("Category still contains products");
      }
      throw error;
    }
  }

  async createProduct(input: CreateProductDto): Promise<ProductEntity> {
    await this.requireCategory(input.category_id);
    const entity = this.products.create({
      ...input,
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
    return this.saveProduct(entity);
  }

  async updateProduct(id: string, input: UpdateProductDto): Promise<ProductEntity> {
    const entity = await this.products.findOneBy({ id });
    if (!entity) throw new NotFoundException("Product was not found");
    if (input.category_id && input.category_id !== entity.category_id) {
      await this.requireCategory(input.category_id);
    }

    this.products.merge(entity, {
      ...input,
      name: input.name?.trim(),
      description: input.description?.trim(),
      stock_label: input.stock_label?.trim()
    });
    return this.saveProduct(entity);
  }

  async deleteProduct(id: string): Promise<void> {
    const result = await this.products.delete(id);
    if (!result.affected) throw new NotFoundException("Product was not found");
  }

  private async requireCategory(id: string): Promise<void> {
    if (!await this.categories.existsBy({ id })) {
      throw new NotFoundException("Category was not found");
    }
  }

  private async saveCategory(entity: CategoryEntity): Promise<CategoryEntity> {
    try {
      return await this.categories.save(entity);
    } catch (error) {
      if (databaseCode(error) === "23505") {
        throw new ConflictException("Category slug already exists");
      }
      throw error;
    }
  }

  private async saveProduct(entity: ProductEntity): Promise<ProductEntity> {
    try {
      return await this.products.save(entity);
    } catch (error) {
      if (databaseCode(error) === "23505") {
        throw new ConflictException("Product slug already exists");
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
