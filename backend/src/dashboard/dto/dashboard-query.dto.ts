import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";

export const reportingRanges = ["7d", "30d", "90d", "12m"] as const;
export type ReportingRange = typeof reportingRanges[number];

export class ReportingPeriodDto {
  @IsOptional()
  @IsIn(reportingRanges)
  range?: ReportingRange = "30d";

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class SalesQueryDto extends ReportingPeriodDto {
  @IsOptional()
  @IsIn(["day", "week", "month"])
  interval?: "day" | "week" | "month";
}

export class TopProductsQueryDto extends ReportingPeriodDto {
  @IsOptional()
  @IsIn(["revenue", "quantity"])
  sort: "revenue" | "quantity" = "revenue";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;
}

export class ActivityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class AuditEventsQueryDto extends ReportingPeriodDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_.]{2,119}$/)
  action?: string;

  @IsOptional()
  @IsIn(["success", "failure"])
  outcome?: "success" | "failure";

  @IsOptional()
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{1,63}$/)
  target_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  target_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
