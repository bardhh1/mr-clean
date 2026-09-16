import { Controller, Get, Header, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AdminAuthGuard } from "../admin/auth/admin-auth.guard";
import { TrustedClientGuard } from "../admin/auth/trusted-client.guard";
import { AdminCsrfGuard } from "../common/security/admin-csrf.guard";
import { AdminOriginGuard } from "../common/security/admin-origin.guard";
import { DashboardService } from "./dashboard.service";
import {
  ActivityQueryDto,
  AuditEventsQueryDto,
  ReportingPeriodDto,
  SalesQueryDto,
  TopProductsQueryDto
} from "./dto/dashboard-query.dto";

@ApiTags("admin dashboard")
@ApiBearerAuth()
@UseGuards(AdminOriginGuard, TrustedClientGuard, AdminAuthGuard, AdminCsrfGuard)
@Controller("admin")
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get("dashboard/summary")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Read delivered sales and order counts" })
  summary(@Query() query: ReportingPeriodDto) {
    return this.dashboard.summary(query);
  }

  @Get("dashboard/sales")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Read zero-filled delivered sales buckets" })
  sales(@Query() query: SalesQueryDto) {
    return this.dashboard.sales(query);
  }

  @Get("dashboard/top-products")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Rank products from delivered order snapshots" })
  topProducts(@Query() query: TopProductsQueryDto) {
    return this.dashboard.topProducts(query);
  }

  @Get("dashboard/activity")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Read recent order and administrator activity" })
  activity(@Query() query: ActivityQueryDto) {
    return this.dashboard.activity(query);
  }

  @Get("audit-events")
  @Header("Cache-Control", "no-store")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Filter and paginate the append-only audit history" })
  auditEvents(@Query() query: AuditEventsQueryDto) {
    return this.dashboard.auditEvents(query);
  }
}
