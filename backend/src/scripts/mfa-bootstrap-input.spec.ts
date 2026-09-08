import { describe, expect, it } from "vitest";
import { readMfaBootstrapInput } from "./mfa-bootstrap-input";

const bootstrapToken = "Ym9vdHN0cmFwLXRva2VuLXRlc3QtdmFsdWUtMzIhISE";

describe("readMfaBootstrapInput", () => {
  it("hashes the one-time token and applies the bounded expiry", () => {
    const now = new Date("2026-09-06T10:00:00.000Z");
    const result = readMfaBootstrapInput({
      MFA_BOOTSTRAP_TOKEN: bootstrapToken,
      MFA_BOOTSTRAP_TTL_MINUTES: "20"
    }, now);

    expect(result.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.expiresAt).toEqual(new Date("2026-09-06T10:20:00.000Z"));
    expect(result.ttlMinutes).toBe(20);
  });

  it("rejects missing, malformed, and out-of-policy inputs", () => {
    expect(() => readMfaBootstrapInput({})).toThrow("MFA_BOOTSTRAP_TOKEN");
    expect(() => readMfaBootstrapInput({ MFA_BOOTSTRAP_TOKEN: "invalid" }))
      .toThrow("invalid");
    expect(() => readMfaBootstrapInput({
      MFA_BOOTSTRAP_TOKEN: bootstrapToken,
      MFA_BOOTSTRAP_TTL_MINUTES: "61"
    })).toThrow("between 5 and 60");
  });
});
