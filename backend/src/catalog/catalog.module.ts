import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { CategoryEntity } from "./entities/category.entity";
import { ProductEntity } from "./entities/product.entity";

@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity, ProductEntity])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService, TypeOrmModule]
})
export class CatalogModule {}
