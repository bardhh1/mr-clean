import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./env.validation";

const validEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mr_clean",
  JWT_ACCESS_SECRET: "a-test-secret-that-is-longer-than-thirty-two-characters",
  AWS_ENDPOINT_URL: "https://storage.invalid",
  AWS_ACCESS_KEY_ID: "test-access-key",
  AWS_SECRET_ACCESS_KEY: "test-secret-key-value",
  AWS_S3_BUCKET_NAME: "test-product-images"
};

describe("validateEnvironment", () => {
  it("provides bounded single-owner authentication defaults", () => {
    const environment = validateEnvironment(validEnvironment);

    expect(environment).toMatchObject({
      JWT_ACCESS_ISSUER: "mr-clean-api",
      JWT_ACCESS_AUDIENCE: "mr-clean-admin",
      REFRESH_TOKEN_TTL_DAYS: 30,
      REFRESH_TOKEN_ABSOLUTE_TTL_DAYS: 45,
      ADMIN_MAX_FAILED_LOGINS: 5,
      ADMIN_LOCKOUT_MINUTES: 15
    });
  });

  it("rejects an absolute session lifetime shorter than the rolling lifetime", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      REFRESH_TOKEN_TTL_DAYS: 30,
      REFRESH_TOKEN_ABSOLUTE_TTL_DAYS: 7
    })).toThrow("REFRESH_TOKEN_ABSOLUTE_TTL_DAYS");
  });
});
