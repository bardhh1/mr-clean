import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { CsrfService } from "./csrf.service";
import { AdminCsrfGuard } from "./admin-csrf.guard";

function context(input: {
  method?: string;
  cookieToken?: string;
  headerToken?: string;
  sessionId?: string;
  refreshToken?: string;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method: input.method ?? "POST",
        admin: input.sessionId ? { session_id: input.sessionId } : undefined,
        cookies: {
          mr_clean_csrf: input.cookieToken,
          mr_clean_refresh: input.refreshToken
        },
        header: (name: string) => name === "x-csrf-token" ? input.headerToken : undefined
      })
    })
  } as unknown as ExecutionContext;
}

describe("AdminCsrfGuard", () => {
  const assertValid = vi.fn();
  const sessionIdFromRefreshToken = vi.fn().mockReturnValue("refresh-session");
  const csrf = {
    assertValid,
    sessionIdFromRefreshToken
  } as unknown as CsrfService;
  const guard = new AdminCsrfGuard(csrf);

  it("requires matching cookie and header tokens bound to the authenticated session", () => {
    const sessionId = randomUUID();
    expect(guard.canActivate(context({
      cookieToken: "token",
      headerToken: "token",
      sessionId
    }))).toBe(true);
    expect(assertValid).toHaveBeenCalledWith("token", sessionId);
  });

  it("uses the refresh session for refresh and logout requests", () => {
    expect(guard.canActivate(context({
      cookieToken: "token",
      headerToken: "token",
      refreshToken: "refresh"
    }))).toBe(true);
    expect(assertValid).toHaveBeenCalledWith("token", "refresh-session");
  });

  it("rejects a missing or mismatched double-submit value and skips safe reads", () => {
    expect(() => guard.canActivate(context({ cookieToken: "one", headerToken: "two" })))
      .toThrow(ForbiddenException);
    expect(() => guard.canActivate(context({}))).toThrow(ForbiddenException);
    expect(guard.canActivate(context({ method: "GET" }))).toBe(true);
  });
});
