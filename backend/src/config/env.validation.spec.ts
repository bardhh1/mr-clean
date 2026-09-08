import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./env.validation";

const validEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mr_clean",
  JWT_ACCESS_SECRET: "a-test-secret-that-is-longer-than-thirty-two-characters",
  MFA_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY",
  MFA_RECOVERY_PEPPER: "cmVjb3ZlcnktcGVwcGVyLXRlc3QtdmFsdWUtMzIhISE",
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
      ADMIN_LOCKOUT_MINUTES: 15,
      ADMIN_LOGIN_MIN_DURATION_MS: 500,
      MFA_ISSUER: "Mr. Clean Admin",
      MFA_CHALLENGE_TTL_SECONDS: 300,
      MFA_MAX_ATTEMPTS: 5,
      MFA_MAX_ACTIVE_CHALLENGES: 3,
      MFA_BOOTSTRAP_TTL_MINUTES: 15
    });
  });

  it("rejects an MFA encryption key that is not exactly 32 bytes", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      MFA_ENCRYPTION_KEY: "dG9vLXNob3J0"
    })).toThrow("MFA_ENCRYPTION_KEY");
  });

  it("rejects malformed Base64URL even when the encryption key has the expected length", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      MFA_ENCRYPTION_KEY: `${validEnvironment.MFA_ENCRYPTION_KEY.slice(0, 42)}+`
    })).toThrow("MFA_ENCRYPTION_KEY");
  });

  it("requires a canonical 32-byte Base64URL recovery pepper", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      MFA_RECOVERY_PEPPER: "not-a-canonical-recovery-pepper-value"
    })).toThrow("MFA_RECOVERY_PEPPER");
  });

  it("requires independent JWT, encryption, and recovery secrets", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      MFA_RECOVERY_PEPPER: validEnvironment.MFA_ENCRYPTION_KEY
    })).toThrow("must be distinct");
  });

  it("rejects non-canonical CORS origins", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      CORS_ORIGINS: "http://localhost:5173/admin"
    })).toThrow("canonical HTTP(S) origins");
  });

  it("requires the secure cross-site cookie policy in production", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      NODE_ENV: "production",
      CORS_ORIGINS: "https://mr-clean.example",
      AUTH_COOKIE_SECURE: false,
      AUTH_COOKIE_SAME_SITE: "lax"
    })).toThrow("production requires AUTH_COOKIE_SECURE=true");

    expect(validateEnvironment({
      ...validEnvironment,
      NODE_ENV: "production",
      CORS_ORIGINS: "https://mr-clean.example",
      AUTH_COOKIE_SECURE: true,
      AUTH_COOKIE_SAME_SITE: "none"
    })).toMatchObject({
      AUTH_COOKIE_SECURE: true,
      AUTH_COOKIE_SAME_SITE: "none"
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
