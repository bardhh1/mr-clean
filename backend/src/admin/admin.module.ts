import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoryEntity } from "../catalog/entities/category.entity";
import { ProductEntity } from "../catalog/entities/product.entity";
import { AdminAuthModule } from "./auth/admin-auth.module";
import { AdminCatalogController } from "./catalog/admin-catalog.controller";
import { AdminCatalogService } from "./catalog/admin-catalog.service";
import { AdminUploadsController } from "./uploads/admin-uploads.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([CategoryEntity, ProductEntity]),
    AdminAuthModule
  ],
  controllers: [AdminCatalogController, AdminUploadsController],
  providers: [AdminCatalogService]
})
export class AdminModule {}
