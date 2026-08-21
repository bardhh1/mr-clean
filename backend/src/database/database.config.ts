import type { ConfigService } from "@nestjs/config";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";
import type { AppEnvironment } from "../config/env.validation";

export function databaseOptions(
  config: ConfigService<AppEnvironment, true>
): TypeOrmModuleOptions {
  const useSsl = config.get("DATABASE_SSL", { infer: true });

  return {
    type: "postgres",
    url: config.get("DATABASE_URL", { infer: true }),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    extra: {
      max: config.get("DATABASE_POOL_MAX", { infer: true }),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000
    }
  };
}
