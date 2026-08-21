import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrdersService } from "./orders.service";

@ApiTags("orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 5 * 60_000 } })
  @ApiOperation({ summary: "Create an idempotent order from current catalog prices" })
  @ApiCreatedResponse({ description: "Immutable order receipt created from server prices." })
  create(@Body() input: CreateOrderDto) {
    return this.orders.create(input);
  }
}
