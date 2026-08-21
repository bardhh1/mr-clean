import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("admin password hashing", () => {
  it("stores a salted scrypt verifier and accepts only the original password", () => {
    const encoded = hashPassword("a-long-production-password");

    expect(encoded).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(encoded).not.toContain("a-long-production-password");
    expect(verifyPassword("a-long-production-password", encoded)).toBe(true);
    expect(verifyPassword("a-different-password", encoded)).toBe(false);
  });

  it("rejects malformed or unsupported verifiers without throwing", () => {
    expect(verifyPassword("anything", "not-a-password-hash")).toBe(false);
    expect(verifyPassword("anything", "scrypt$999999999$8$1$salt$hash")).toBe(false);
  });
});
