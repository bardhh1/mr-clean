import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import type { Request } from "express";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AdminCsrfGuard } from "../common/security/admin-csrf.guard";
import { AdminOriginGuard } from "../common/security/admin-origin.guard";
import { AuditService } from "../audit/audit.service";
import { AdminAuthGuard } from "../admin/auth/admin-auth.guard";
import { TrustedClientGuard } from "../admin/auth/trusted-client.guard";
import { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import { OrdersService } from "./orders.service";

@ApiTags("admin orders")
@ApiBearerAuth()
@UseGuards(AdminOriginGuard, TrustedClientGuard, AdminAuthGuard, AdminCsrfGuard)
@Controller("admin/orders")
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly audit: AuditService
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Search and paginate customer orders" })
  list(@Query() query: ListOrdersQueryDto) {
    return this.orders.list(query);
  }

  @Get(":id")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "Read one order with immutable item snapshots" })
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.orders.getById(id);
  }

  @Patch(":id/status")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Advance an order through an allowed status transition" })
  updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdateOrderStatusDto,
    @Req() request: Request
  ) {
    return this.orders.updateStatus(id, input.status, this.audit.context(request));
  }
}
