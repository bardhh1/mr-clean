import { describe, expect, it, vi } from "vitest";
import type { DataSource } from "typeorm";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  it("reports liveness without touching external dependencies", () => {
    const query = vi.fn();
    const database = { query } as unknown as DataSource;
    const result = new HealthService(database).status();

    expect(result.status).toBe("ok");
    expect(result.service).toBe("mr-clean-api");
    expect(query).not.toHaveBeenCalled();
  });

  it("only reports ready after Supabase responds", async () => {
    const query = vi.fn().mockResolvedValue([{ "?column?": 1 }]);
    const database = { query } as unknown as DataSource;

    await expect(new HealthService(database).readiness()).resolves.toMatchObject({
      status: "ready",
      dependencies: { database: "up" }
    });
    expect(query).toHaveBeenCalledWith("select 1");
  });
});
