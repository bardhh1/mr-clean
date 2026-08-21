import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { RequestIdInterceptor } from "./common/interceptors/request-id.interceptor";
import { validateEnvironment } from "./config/env.validation";
import { CatalogModule } from "./catalog/catalog.module";
import { AdminModule } from "./admin/admin.module";
import { databaseOptions } from "./database/database.config";
import { HealthModule } from "./health/health.module";
import { StorageModule } from "./storage/storage.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120
      }
    ]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: databaseOptions
    }),
    StorageModule,
    HealthModule,
    CatalogModule,
    AdminModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter }
  ]
})
export class AppModule {}
