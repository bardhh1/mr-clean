import { describe, expect, it } from "vitest";
import {
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyTotp
} from "./mfa";

const encryptionKey = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

describe("MFA primitives", () => {
  it("matches the RFC 6238 SHA-1 test secret with six-digit truncation", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(verifyTotp(secret, "287082", { now: 59_000 })).toBe(1);
  });

  it("rejects a TOTP counter that was already accepted", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(verifyTotp(secret, "287082", {
      now: 59_000,
      lastAcceptedCounter: 1
    })).toBeNull();
  });

  it("encrypts secrets with authenticated context", () => {
    const envelope = encryptMfaSecret("SECRET", encryptionKey, "owner:1");
    expect(envelope).not.toContain("SECRET");
    expect(decryptMfaSecret(envelope, encryptionKey, "owner:1")).toBe("SECRET");
    expect(() => decryptMfaSecret(envelope, encryptionKey, "owner:2")).toThrow();
  });

  it("creates normalized, independently hashed recovery codes", () => {
    const [code] = generateRecoveryCodes(1);
    expect(code).toMatch(/^[A-Z2-7]{4}(?:-[A-Z2-7]{4}){3}$/);
    expect(normalizeRecoveryCode(code.toLowerCase())).toBe(code.replaceAll("-", ""));
    expect(hashRecoveryCode(code, "pepper-one-that-is-long-enough-1234"))
      .not.toBe(hashRecoveryCode(code, "pepper-two-that-is-long-enough-1234"));
  });
});
