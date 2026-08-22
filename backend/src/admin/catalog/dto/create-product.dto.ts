import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateProductDto {
  @ApiPropertyOptional({ pattern: "^[0-9]{4}$" })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{4}$/)
  catalog_code?: string;

  @ApiProperty()
  @IsUUID()
  category_id!: string;

  @ApiProperty({ minLength: 2, maxLength: 160 })
  @IsString()
  @Length(2, 160)
  name!: string;

  @ApiPropertyOptional({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(180)
  slug?: string;

  @ApiProperty({ minLength: 8, maxLength: 4000 })
  @IsString()
  @Length(8, 4000)
  description!: string;

  @ApiProperty({ minimum: 0, maximum: 100_000_000 })
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  price_cents!: number;

  @ApiProperty({ minLength: 1, maxLength: 80 })
  @IsString()
  @Length(1, 80)
  unit!: string;

  @ApiPropertyOptional({ type: [String], maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(/^(https?:\/\/|\/)/, { each: true })
  image_urls?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: 10 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(/^products\/[a-zA-Z0-9._/-]+$/, { each: true })
  image_keys?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_featured?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requires_quote?: boolean;

  @ApiPropertyOptional({ default: "Në stok", maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  stock_label?: string;
}
