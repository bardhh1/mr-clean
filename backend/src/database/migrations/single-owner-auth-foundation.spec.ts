import type { QueryRunner } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import { SingleOwnerAuthFoundation1788021000000 } from "./1788021000000-single-owner-auth-foundation";

describe("single-owner authentication migration", () => {
  it("introduces the singleton, lockout, and session-family invariants", async () => {
    const statements: string[] = [];
    const queryRunner = {
      query: vi.fn(async (sql: string) => {
        statements.push(sql);
        return undefined;
      })
    } as unknown as QueryRunner;

    await new SingleOwnerAuthFoundation1788021000000().up(queryRunner);
    const sql = statements.join("\n");

    expect(sql).toContain("single-owner migration requires at most one active administrator");
    expect(sql).toContain("uq_admin_users_single_active");
    expect(sql).toContain("failed_login_count");
    expect(sql).toContain("family_expires_at");
    expect(sql).toContain("rotated_to_session_id");
    expect(sql).toContain("reuse_detected");
    expect(sql).toContain("fk_admin_sessions_parent");
  });
});
