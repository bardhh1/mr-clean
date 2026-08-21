import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AdminAuthGuard } from "../admin/auth/admin-auth.guard";
import { TrustedClientGuard } from "../admin/auth/trusted-client.guard";
import { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { OrdersService } from "./orders.service";

@ApiTags("admin orders")
@ApiBearerAuth()
@UseGuards(AdminAuthGuard, TrustedClientGuard)
@Controller("admin/orders")
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "Search and paginate customer orders" })
  list(@Query() query: ListOrdersQueryDto) {
    return this.orders.list(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Read one order with immutable item snapshots" })
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.orders.getById(id);
  }

  @Patch(":id/status")
  @ApiOperation({ summary: "Advance an order through an allowed status transition" })
  updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateOrderStatusDto
  ) {
    return this.orders.updateStatus(id, input.status);
  }
}
