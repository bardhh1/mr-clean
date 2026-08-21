import { Transform, Type } from "class-transformer";
import type { TransformFnParams } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import { CreateOrderItemDto } from "./create-order-item.dto";

export class CreateOrderDto {
  @IsUUID()
  idempotency_key!: string;

  @IsString()
  @Transform(trimString)
  @MinLength(2)
  @MaxLength(120)
  customer_name!: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(160)
  company_name?: string;

  @IsString()
  @Transform(trimString)
  @Matches(/^[+0-9][0-9 .()/-]{5,29}$/)
  phone!: string;

  @IsString()
  @Transform(trimString)
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @IsString()
  @Transform(trimString)
  @MinLength(4)
  @MaxLength(300)
  address!: string;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @MaxLength(1_000)
  notes?: string;

  @IsIn(["cash", "bank_transfer"])
  payment_preference!: "cash" | "bank_transfer";

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique((item: CreateOrderItemDto) => item.product_id)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === "string" ? value.trim() : value as unknown;
}
