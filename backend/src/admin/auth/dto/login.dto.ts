import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "admin@mr-clean.com" })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 12 })
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
