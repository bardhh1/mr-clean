import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { TrustedClientGuard } from "./trusted-client.guard";

function contextWithHeader(value?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ header: () => value })
    })
  } as unknown as ExecutionContext;
}

describe("TrustedClientGuard", () => {
  const guard = new TrustedClientGuard();

  it("accepts requests from the storefront client", () => {
    expect(guard.canActivate(contextWithHeader("mr-clean-web-v1"))).toBe(true);
  });

  it("rejects requests without the agreed client header", () => {
    expect(() => guard.canActivate(contextWithHeader())).toThrow(UnauthorizedException);
  });
});
