import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { TrustedClientGuard } from "../auth/trusted-client.guard";
import { AdminCatalogService } from "./admin-catalog.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@ApiTags("admin catalog")
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, TrustedClientGuard)
@Controller("admin")
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get("categories")
  @ApiOperation({ summary: "List every category, including inactive records" })
  categories() {
    return this.catalog.listCategories();
  }

  @Post("categories")
  @ApiOperation({ summary: "Create a category" })
  createCategory(@Body() input: CreateCategoryDto) {
    return this.catalog.createCategory(input);
  }

  @Patch("categories/:id")
  @ApiOperation({ summary: "Update a category" })
  updateCategory(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateCategoryDto
  ) {
    return this.catalog.updateCategory(id, input);
  }

  @Delete("categories/:id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete an empty category" })
  deleteCategory(@Param("id", ParseUUIDPipe) id: string) {
    return this.catalog.deleteCategory(id);
  }

  @Get("products")
  @ApiOperation({ summary: "List every product, including inactive records" })
  products() {
    return this.catalog.listProducts();
  }

  @Post("products")
  @ApiOperation({ summary: "Create a product" })
  createProduct(@Body() input: CreateProductDto) {
    return this.catalog.createProduct(input);
  }

  @Patch("products/:id")
  @ApiOperation({ summary: "Update product content, pricing, images, or visibility" })
  updateProduct(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateProductDto
  ) {
    return this.catalog.updateProduct(id, input);
  }

  @Delete("products/:id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a product" })
  deleteProduct(@Param("id", ParseUUIDPipe) id: string) {
    return this.catalog.deleteProduct(id);
  }
}
