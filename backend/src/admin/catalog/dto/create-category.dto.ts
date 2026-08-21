import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(140)
  slug?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: 99, minimum: 0, maximum: 10_000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  sort_order?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
