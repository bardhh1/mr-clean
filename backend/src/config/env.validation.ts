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
  JWT_ACCESS_ISSUER: string;
  JWT_ACCESS_AUDIENCE: string;
  JWT_ACCESS_TTL_SECONDS: number;
  REFRESH_TOKEN_TTL_DAYS: number;
  REFRESH_TOKEN_ABSOLUTE_TTL_DAYS: number;
  ADMIN_MAX_FAILED_LOGINS: number;
  ADMIN_LOCKOUT_MINUTES: number;
  ADMIN_LOGIN_MIN_DURATION_MS: number;
  MFA_ENCRYPTION_KEY: string;
  MFA_RECOVERY_PEPPER: string;
  MFA_ISSUER: string;
  MFA_CHALLENGE_TTL_SECONDS: number;
  MFA_MAX_ATTEMPTS: number;
  MFA_MAX_ACTIVE_CHALLENGES: number;
  MFA_BOOTSTRAP_TTL_MINUTES: number;
  AUTH_COOKIE_SECURE: boolean;
  AUTH_COOKIE_SAME_SITE: "lax" | "strict" | "none";
  AWS_ENDPOINT_URL: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_S3_BUCKET_NAME: string;
  AWS_DEFAULT_REGION: string;
  AWS_S3_URL_STYLE: "virtual" | "path";
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
  JWT_ACCESS_ISSUER: Joi.string().trim().min(3).max(120).default("mr-clean-api"),
  JWT_ACCESS_AUDIENCE: Joi.string().trim().min(3).max(120).default("mr-clean-admin"),
  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
  REFRESH_TOKEN_ABSOLUTE_TTL_DAYS: Joi.number().integer().min(1).max(365).default(45),
  ADMIN_MAX_FAILED_LOGINS: Joi.number().integer().min(3).max(20).default(5),
  ADMIN_LOCKOUT_MINUTES: Joi.number().integer().min(1).max(1_440).default(15),
  ADMIN_LOGIN_MIN_DURATION_MS: Joi.number().integer().min(0).max(2_000).default(500),
  MFA_ENCRYPTION_KEY: Joi.string().pattern(/^[A-Za-z0-9_-]{43}$/).required(),
  MFA_RECOVERY_PEPPER: Joi.string().pattern(/^[A-Za-z0-9_-]{43}$/).required(),
  MFA_ISSUER: Joi.string().trim().min(3).max(80).default("Mr. Clean Admin"),
  MFA_CHALLENGE_TTL_SECONDS: Joi.number().integer().min(120).max(600).default(300),
  MFA_MAX_ATTEMPTS: Joi.number().integer().min(3).max(10).default(5),
  MFA_MAX_ACTIVE_CHALLENGES: Joi.number().integer().min(2).max(5).default(3),
  MFA_BOOTSTRAP_TTL_MINUTES: Joi.number().integer().min(5).max(60).default(15),
  AUTH_COOKIE_SECURE: Joi.boolean().truthy("true").falsy("false").default(false),
  AUTH_COOKIE_SAME_SITE: Joi.string().valid("lax", "strict", "none").default("lax"),
  AWS_ENDPOINT_URL: Joi.string().uri({ scheme: ["https"] }).required(),
  AWS_ACCESS_KEY_ID: Joi.string().min(8).required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().min(16).required(),
  AWS_S3_BUCKET_NAME: Joi.string().min(3).required(),
  AWS_DEFAULT_REGION: Joi.string().default("auto"),
  AWS_S3_URL_STYLE: Joi.string().valid("virtual", "path").default("virtual")
}).unknown(true);

export function validateEnvironment(input: Record<string, unknown>): AppEnvironment {
  const validation = environmentSchema.validate(input, {
    abortEarly: false,
    convert: true
  });

  if (validation.error) {
    throw new Error(`Invalid environment configuration: ${validation.error.message}`);
  }

  if (validation.value.REFRESH_TOKEN_ABSOLUTE_TTL_DAYS < validation.value.REFRESH_TOKEN_TTL_DAYS) {
    throw new Error(
      "Invalid environment configuration: REFRESH_TOKEN_ABSOLUTE_TTL_DAYS must be greater than or equal to REFRESH_TOKEN_TTL_DAYS"
    );
  }

  assertEncodedSecret(validation.value.MFA_ENCRYPTION_KEY, "MFA_ENCRYPTION_KEY");
  assertEncodedSecret(validation.value.MFA_RECOVERY_PEPPER, "MFA_RECOVERY_PEPPER");

  const secrets = new Set([
    validation.value.JWT_ACCESS_SECRET,
    validation.value.MFA_ENCRYPTION_KEY,
    validation.value.MFA_RECOVERY_PEPPER
  ]);
  if (secrets.size !== 3) {
    throw new Error(
      "Invalid environment configuration: JWT_ACCESS_SECRET, MFA_ENCRYPTION_KEY, and MFA_RECOVERY_PEPPER must be distinct"
    );
  }

  validateOrigins(validation.value.CORS_ORIGINS, validation.value.NODE_ENV);

  if (
    validation.value.AUTH_COOKIE_SAME_SITE === "none"
    && !validation.value.AUTH_COOKIE_SECURE
  ) {
    throw new Error(
      "Invalid environment configuration: AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE is none"
    );
  }
  if (validation.value.NODE_ENV === "production") {
    if (
      !validation.value.AUTH_COOKIE_SECURE
      || validation.value.AUTH_COOKIE_SAME_SITE !== "none"
    ) {
      throw new Error(
        "Invalid environment configuration: production requires AUTH_COOKIE_SECURE=true and AUTH_COOKIE_SAME_SITE=none for the Vercel-to-Railway boundary"
      );
    }
    if (validation.value.ADMIN_LOGIN_MIN_DURATION_MS < 250) {
      throw new Error(
        "Invalid environment configuration: production ADMIN_LOGIN_MIN_DURATION_MS must be at least 250"
      );
    }
  }

  return validation.value;
}

function assertEncodedSecret(value: string, name: string): void {
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== value) {
    throw new Error(
      `Invalid environment configuration: ${name} must be the unpadded Base64URL encoding of exactly 32 bytes`
    );
  }
}

function validateOrigins(value: string, nodeEnvironment: AppEnvironment["NODE_ENV"]): void {
  const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
  if (origins.length === 0) {
    throw new Error("Invalid environment configuration: CORS_ORIGINS must not be empty");
  }

  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid environment configuration: invalid CORS origin ${origin}`);
    }
    if (
      !["http:", "https:"].includes(parsed.protocol)
      || parsed.origin !== origin
      || parsed.username
      || parsed.password
      || parsed.pathname !== "/"
      || parsed.search
      || parsed.hash
      || origin.includes("*")
    ) {
      throw new Error(
        `Invalid environment configuration: CORS_ORIGINS entries must be canonical HTTP(S) origins (${origin})`
      );
    }
    if (nodeEnvironment === "production" && parsed.protocol !== "https:") {
      throw new Error(
        `Invalid environment configuration: production CORS_ORIGINS must use HTTPS (${origin})`
      );
    }
  }
}
