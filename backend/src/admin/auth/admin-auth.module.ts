import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import type { AppEnvironment } from "../../config/env.validation";
import { AdminSessionEntity } from "../entities/admin-session.entity";
import { AdminUserEntity } from "../entities/admin-user.entity";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthGuard } from "./admin-auth.guard";
import { AdminAuthService } from "./admin-auth.service";
import { TrustedClientGuard } from "./trusted-client.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUserEntity, AdminSessionEntity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnvironment, true>) => ({
        secret: config.get("JWT_ACCESS_SECRET", { infer: true })
      })
    })
  ],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminAuthGuard, TrustedClientGuard],
  exports: [AdminAuthService, AdminAuthGuard, TrustedClientGuard, TypeOrmModule]
})
export class AdminAuthModule {}
