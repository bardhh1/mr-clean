import "reflect-metadata";
import { DataSource } from "typeorm";

const useSsl = process.env.DATABASE_SSL === "true";

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: [`${__dirname}/../**/*.entity{.js,.ts}`],
  migrations: [`${__dirname}/migrations/*{.js,.ts}`],
  migrationsTableName: "mr_clean_migrations",
  synchronize: false,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  extra: {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000
  }
});
