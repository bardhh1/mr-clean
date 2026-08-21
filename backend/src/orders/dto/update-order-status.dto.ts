import { IsIn } from "class-validator";
import { orderStatuses, type OrderStatus } from "../entities/order.entity";

export class UpdateOrderStatusDto {
  @IsIn(orderStatuses)
  status!: OrderStatus;
}
