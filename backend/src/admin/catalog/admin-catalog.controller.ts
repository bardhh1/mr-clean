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
  Req,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AdminCsrfGuard } from "../../common/security/admin-csrf.guard";
import { AdminOriginGuard } from "../../common/security/admin-origin.guard";
import { AuditService } from "../../audit/audit.service";
import { AdminAuthGuard } from "../auth/admin-auth.guard";
import { TrustedClientGuard } from "../auth/trusted-client.guard";
import { AdminCatalogService } from "./admin-catalog.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@ApiTags("admin catalog")
@ApiBearerAuth()
@UseGuards(AdminOriginGuard, TrustedClientGuard, AdminAuthGuard, AdminCsrfGuard)
@Controller("admin")
export class AdminCatalogController {
  constructor(
    private readonly catalog: AdminCatalogService,
    private readonly audit: AuditService
  ) {}

  @Get("categories")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "List every category, including inactive records" })
  categories() {
    return this.catalog.listCategories();
  }

  @Post("categories")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Create a category" })
  createCategory(@Body() input: CreateCategoryDto, @Req() request: Request) {
    return this.catalog.createCategory(input, this.audit.context(request));
  }

  @Patch("categories/:id")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Update a category" })
  updateCategory(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateCategoryDto,
    @Req() request: Request
  ) {
    return this.catalog.updateCategory(id, input, this.audit.context(request));
  }

  @Delete("categories/:id")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(204)
  @ApiOperation({ summary: "Delete an empty category" })
  deleteCategory(@Param("id", ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.catalog.deleteCategory(id, this.audit.context(request));
  }

  @Get("products")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "List every product, including inactive records" })
  products() {
    return this.catalog.listProducts();
  }

  @Post("products")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: "Create a product" })
  createProduct(@Body() input: CreateProductDto, @Req() request: Request) {
    return this.catalog.createProduct(input, this.audit.context(request));
  }

  @Patch("products/:id")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Update product content, pricing, images, or visibility" })
  updateProduct(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateProductDto,
    @Req() request: Request
  ) {
    return this.catalog.updateProduct(id, input, this.audit.context(request));
  }

  @Delete("products/:id")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a product" })
  deleteProduct(@Param("id", ParseUUIDPipe) id: string, @Req() request: Request) {
    return this.catalog.deleteProduct(id, this.audit.context(request));
  }
}
