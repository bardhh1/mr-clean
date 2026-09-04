import type { QueryRunner } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import { AdminMfaFoundation1788480000000 } from "./1788480000000-admin-mfa-foundation";

describe("administrator MFA migration", () => {
  it("enforces MFA state, one-time challenges, recovery codes, and old-session revocation", async () => {
    const statements: string[] = [];
    const queryRunner = {
      query: vi.fn(async (sql: string) => {
        statements.push(sql);
        return undefined;
      })
    } as unknown as QueryRunner;

    await new AdminMfaFoundation1788480000000().up(queryRunner);
    const sql = statements.join("\n");

    expect(sql).toContain("ck_admin_users_mfa_state");
    expect(sql).toContain("admin_mfa_challenges");
    expect(sql).toContain("admin_mfa_recovery_codes");
    expect(sql).toContain("mfa_enrollment_required");
    expect(sql).toContain("mfa_verified_at");
    expect(sql).toContain("pending_secret_ciphertext");
    expect(sql).toContain("WHERE \"revoked_at\" IS NULL");
  });
});
