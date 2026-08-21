import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { CatalogService } from "./catalog.service";
import { CatalogQueryDto } from "./dto/catalog-query.dto";

@ApiTags("catalog")
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  @ApiOperation({ summary: "List active catalog categories" })
  @ApiOkResponse({ description: "Categories ordered for storefront navigation." })
  listCategories() {
    return this.catalog.listCategories();
  }

  @Get("categories/:slug")
  @ApiOperation({ summary: "Get one active category by slug" })
  @ApiNotFoundResponse({ description: "The category is missing or inactive." })
  getCategory(@Param("slug") slug: string) {
    return this.catalog.getCategoryBySlug(slug);
  }

  @Get("products")
  @ApiOperation({ summary: "Search and filter active catalog products" })
  @ApiOkResponse({ description: "A paginated product result." })
  listProducts(@Query() query: CatalogQueryDto) {
    return this.catalog.listProducts(query);
  }

  @Get("products/:slug")
  @ApiOperation({ summary: "Get one active product by slug" })
  @ApiNotFoundResponse({ description: "The product is missing or inactive." })
  getProduct(@Param("slug") slug: string) {
    return this.catalog.getProductBySlug(slug);
  }
}
