import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength } from "class-validator";

export class DeleteUploadDto {
  @ApiProperty({ example: "products/01234567-89ab-cdef-0123-456789abcdef.webp" })
  @IsString()
  @MaxLength(300)
  @Matches(/^products\/[a-zA-Z0-9._/-]+$/)
  key!: string;
}
