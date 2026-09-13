import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { AppEnvironment } from "../../config/env.validation";
import { CsrfService } from "./csrf.service";

const config = {
  get: () => "Y3NyZi10ZXN0LXNlY3JldC12YWx1ZS0zMi1ieXRlcyE"
} as unknown as ConfigService<AppEnvironment, true>;

describe("CsrfService", () => {
  const service = new CsrfService(config);

  it("issues a session-bound token and accepts it only for that session", () => {
    const sessionId = randomUUID();
    const token = service.issue(sessionId, 60_000);

    expect(() => service.assertValid(token, sessionId)).not.toThrow();
    expect(() => service.assertValid(token, randomUUID())).toThrow(ForbiddenException);
  });

  it("rejects tampered and expired tokens", () => {
    const now = 1_800_000_000_000;
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const sessionId = randomUUID();
    const token = service.issue(sessionId, 1_000);
    const tokenParts = token.split(".");
    const signature = tokenParts.at(-1) ?? "";
    tokenParts[tokenParts.length - 1] = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;

    expect(() => service.assertValid(tokenParts.join("."), sessionId))
      .toThrow(ForbiddenException);
    clock.mockReturnValue(now + 1_001);
    expect(() => service.assertValid(token, sessionId)).toThrow(ForbiddenException);
  });

  it("extracts only a structurally valid refresh-session ID", () => {
    const sessionId = randomUUID();
    expect(service.sessionIdFromRefreshToken(`${sessionId}.secret`)).toBe(sessionId);
    expect(() => service.sessionIdFromRefreshToken("invalid"))
      .toThrow(ForbiddenException);
  });
});
