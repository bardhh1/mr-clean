import Joi from "joi";

export type AppEnvironment = {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  API_PREFIX: string;
  CORS_ORIGINS: string;
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
  DATABASE_POOL_MAX: number;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_TTL: string;
  REFRESH_TOKEN_TTL_DAYS: number;
  AUTH_COOKIE_SECURE: boolean;
  AUTH_COOKIE_SAME_SITE: "lax" | "strict" | "none";
};

const environmentSchema = Joi.object<AppEnvironment>({
  NODE_ENV: Joi.string().valid("development", "test", "production").default("development"),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().trim().default("api/v1"),
  CORS_ORIGINS: Joi.string().trim().default("http://localhost:5173"),
  DATABASE_URL: Joi.string().uri({ scheme: ["postgres", "postgresql"] }).required(),
  DATABASE_SSL: Joi.boolean().truthy("true").falsy("false").default(false),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).max(50).default(10),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().pattern(/^\d+[smhd]$/).default("15m"),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
  AUTH_COOKIE_SECURE: Joi.boolean().truthy("true").falsy("false").default(false),
  AUTH_COOKIE_SAME_SITE: Joi.string().valid("lax", "strict", "none").default("lax")
}).unknown(true);

export function validateEnvironment(input: Record<string, unknown>): AppEnvironment {
  const validation = environmentSchema.validate(input, {
    abortEarly: false,
    convert: true
  });

  if (validation.error) {
    throw new Error(`Invalid environment configuration: ${validation.error.message}`);
  }

  return validation.value;
}
