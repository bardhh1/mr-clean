import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminAuthModule } from "../admin/auth/admin-auth.module";
import { ProductEntity } from "../catalog/entities/product.entity";
import { EmailModule } from "../email/email.module";
import { AdminOrdersController } from "./admin-orders.controller";
import { OrderItemEntity } from "./entities/order-item.entity";
import { OrderEntity } from "./entities/order.entity";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, OrderItemEntity, ProductEntity]),
    AdminAuthModule,
    EmailModule
  ],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}
