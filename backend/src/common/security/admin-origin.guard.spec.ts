import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import type { AppEnvironment } from "../../config/env.validation";
import { AdminOriginGuard } from "./admin-origin.guard";

const config = {
  get: () => "https://mr-clean.example,http://localhost:5173"
} as unknown as ConfigService<AppEnvironment, true>;

function context(method: string, origin?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, header: (name: string) => name === "origin" ? origin : undefined })
    })
  } as unknown as ExecutionContext;
}

describe("AdminOriginGuard", () => {
  const guard = new AdminOriginGuard(config);

  it("accepts exact configured origins and safe reads", () => {
    expect(guard.canActivate(context("POST", "https://mr-clean.example"))).toBe(true);
    expect(guard.canActivate(context("GET"))).toBe(true);
  });

  it("rejects missing, lookalike, and unconfigured origins", () => {
    expect(() => guard.canActivate(context("POST"))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context("POST", "https://mr-clean.example.evil.test")))
      .toThrow(ForbiddenException);
    expect(() => guard.canActivate(context("DELETE", "https://evil.test")))
      .toThrow(ForbiddenException);
  });
});
