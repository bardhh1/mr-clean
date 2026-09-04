import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class MfaVerifyDto {
  @ApiProperty({ description: "Opaque, short-lived challenge returned by the password step." })
  @IsString()
  @MinLength(64)
  @MaxLength(180)
  challenge_token!: string;

  @ApiProperty({ description: "Six-digit authenticator code or one recovery code." })
  @IsString()
  @MaxLength(32)
  @Matches(/^(?:\d{6}|[A-Za-z2-7]{4}(?:-[A-Za-z2-7]{4}){3})$/)
  code!: string;
}

export class MfaRecoveryCodesDto {
  @ApiProperty({ description: "A current six-digit authenticator code." })
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;
}
