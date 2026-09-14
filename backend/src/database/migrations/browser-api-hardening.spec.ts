import type { QueryRunner } from "typeorm";
import { describe, expect, it, vi } from "vitest";
import { BrowserApiHardening1788998400000 } from "./1788998400000-browser-api-hardening";

describe("browser and API hardening migration", () => {
  it("creates a bounded append-only administrator audit ledger", async () => {
    const statements: string[] = [];
    const queryRunner = {
      query: vi.fn(async (sql: string) => {
        statements.push(sql);
        return undefined;
      })
    } as unknown as QueryRunner;

    await new BrowserApiHardening1788998400000().up(queryRunner);
    const sql = statements.join("\n");

    expect(sql).toContain("admin_audit_events");
    expect(sql).toContain("ck_admin_audit_events_metadata");
    expect(sql).toContain("BEFORE UPDATE OR DELETE");
    expect(sql).toContain("BEFORE TRUNCATE");
    expect(sql).toContain("append-only");
    expect(sql).not.toContain("ON DELETE CASCADE");
  });
});
