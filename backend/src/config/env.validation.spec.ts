import { describe, expect, it } from "vitest";
import { validateEnvironment } from "./env.validation";

const validEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mr_clean",
  JWT_ACCESS_SECRET: "a-test-secret-that-is-longer-than-thirty-two-characters",
  MFA_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY",
  MFA_RECOVERY_PEPPER: "cmVjb3ZlcnktcGVwcGVyLXRlc3QtdmFsdWUtMzIhISE",
  CSRF_SECRET: "Y3NyZi10ZXN0LXNlY3JldC12YWx1ZS0zMi1ieXRlcyE",
  AUDIT_HMAC_KEY: "YXVkaXQtdGVzdC1oYXNoLWtleS12YWx1ZS0zMiEhISE",
  EMAIL_DELIVERY_ENABLED: false,
  EMAIL_FROM: "Mr. Clean <orders@example.com>",
  ORDER_OWNER_EMAIL: "owner@example.com",
  AWS_ENDPOINT_URL: "https://storage.invalid",
  AWS_ACCESS_KEY_ID: "test-access-key",
  AWS_SECRET_ACCESS_KEY: "test-secret-key-value",
  AWS_S3_BUCKET_NAME: "test-product-images"
};

const productionPolicy = {
  CORS_ORIGINS: "https://www.mrclean-ks.com",
  AUTH_COOKIE_SECURE: true,
  AUTH_COOKIE_SAME_SITE: "strict",
  SWAGGER_ENABLED: false,
  EMAIL_DELIVERY_ENABLED: true,
  RESEND_API_KEY: "re_production_test_key",
  TURNSTILE_ENABLED: true,
  TURNSTILE_SECRET_KEY: "production-turnstile-secret-key",
  TURNSTILE_EXPECTED_HOSTNAMES: "www.mrclean-ks.com"
} as const;

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
      MFA_BOOTSTRAP_TTL_MINUTES: 15,
      EMAIL_OUTBOX_POLL_INTERVAL_MS: 5_000,
      EMAIL_OUTBOX_BATCH_SIZE: 20,
      EMAIL_OUTBOX_MAX_ATTEMPTS: 8,
      TURNSTILE_ENABLED: false,
      TURNSTILE_EXPECTED_HOSTNAMES: "localhost",
      ORDER_GLOBAL_LIMIT_PER_HOUR: 60,
      ORDER_RECIPIENT_LIMIT_PER_DAY: 3
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

  it("requires canonical independent CSRF and audit HMAC secrets", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      CSRF_SECRET: "not-a-canonical-csrf-secret"
    })).toThrow("CSRF_SECRET");

    expect(() => validateEnvironment({
      ...validEnvironment,
      AUDIT_HMAC_KEY: validEnvironment.CSRF_SECRET
    })).toThrow("must be distinct");
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

  it("requires the secure same-origin cookie and Swagger policy in production", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      ...productionPolicy,
      NODE_ENV: "production",
      AUTH_COOKIE_SECURE: false,
    })).toThrow("production requires AUTH_COOKIE_SECURE=true");

    expect(validateEnvironment({
      ...validEnvironment,
      ...productionPolicy,
      NODE_ENV: "production",
    })).toMatchObject({
      AUTH_COOKIE_SECURE: true,
      AUTH_COOKIE_SAME_SITE: "strict",
      SWAGGER_ENABLED: false
    });

    expect(() => validateEnvironment({
      ...validEnvironment,
      ...productionPolicy,
      NODE_ENV: "production",
      SWAGGER_ENABLED: true,
    })).toThrow("SWAGGER_ENABLED=false");
  });

  it("rejects an absolute session lifetime shorter than the rolling lifetime", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      REFRESH_TOKEN_TTL_DAYS: 30,
      REFRESH_TOKEN_ABSOLUTE_TTL_DAYS: 7
    })).toThrow("REFRESH_TOKEN_ABSOLUTE_TTL_DAYS");
  });

  it("requires email delivery and a Resend key in production", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      ...productionPolicy,
      NODE_ENV: "production",
      EMAIL_DELIVERY_ENABLED: false
    })).toThrow("EMAIL_DELIVERY_ENABLED=true");

    expect(() => validateEnvironment({
      ...validEnvironment,
      EMAIL_DELIVERY_ENABLED: true
    })).toThrow("RESEND_API_KEY");
  });

  it("requires server-verified Turnstile with canonical production hostnames", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      ...productionPolicy,
      NODE_ENV: "production",
      TURNSTILE_ENABLED: false
    })).toThrow("TURNSTILE_ENABLED=true");

    expect(() => validateEnvironment({
      ...validEnvironment,
      ...productionPolicy,
      NODE_ENV: "production",
      TURNSTILE_EXPECTED_HOSTNAMES: "https://www.mrclean-ks.com/*"
    })).toThrow("invalid TURNSTILE_EXPECTED_HOSTNAMES");
  });

  it("rejects malformed sender and owner email configuration", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      EMAIL_FROM: "Mr. Clean <orders@example.com>\r\nBcc: attacker@example.com"
    })).toThrow("EMAIL_FROM");

    expect(() => validateEnvironment({
      ...validEnvironment,
      ORDER_OWNER_EMAIL: "not-an-email"
    })).toThrow("ORDER_OWNER_EMAIL");
  });

  it("rejects an outbox lease shorter than the worst-case batch send time", () => {
    expect(() => validateEnvironment({
      ...validEnvironment,
      EMAIL_OUTBOX_BATCH_SIZE: 20,
      EMAIL_OUTBOX_LOCK_TIMEOUT_SECONDS: 120
    })).toThrow("EMAIL_OUTBOX_BATCH_SIZE * 12");
  });
});
