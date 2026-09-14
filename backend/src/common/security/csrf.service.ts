import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AppEnvironment } from "../../config/env.validation";

const tokenVersion = "v1";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CsrfService {
  constructor(private readonly config: ConfigService<AppEnvironment, true>) {}

  issue(sessionId: string, maxAgeMs: number): string {
    if (!uuidPattern.test(sessionId) || !Number.isSafeInteger(maxAgeMs) || maxAgeMs <= 0) {
      throw new Error("Cannot issue a CSRF token for an invalid session");
    }
    const expiresAt = Date.now() + maxAgeMs;
    const nonce = randomBytes(24).toString("base64url");
    const payload = `${tokenVersion}.${sessionId}.${expiresAt}.${nonce}`;
    return `${payload}.${this.sign(payload)}`;
  }

  assertValid(token: string, expectedSessionId: string): void {
    const [version, sessionId, expiresAtValue, nonce, signature, ...rest] = token.split(".");
    const expiresAt = Number(expiresAtValue);
    if (
      version !== tokenVersion
      || sessionId !== expectedSessionId
      || !uuidPattern.test(sessionId ?? "")
      || !/^\d{13}$/.test(expiresAtValue ?? "")
      || !Number.isSafeInteger(expiresAt)
      || expiresAt <= Date.now()
      || !/^[A-Za-z0-9_-]{32}$/.test(nonce ?? "")
      || !/^[A-Za-z0-9_-]{43}$/.test(signature ?? "")
      || rest.length > 0
    ) {
      throw new ForbiddenException("CSRF validation failed");
    }

    const payload = `${version}.${sessionId}.${expiresAtValue}.${nonce}`;
    const expected = Buffer.from(this.sign(payload), "base64url");
    const actual = Buffer.from(signature, "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new ForbiddenException("CSRF validation failed");
    }
  }

  sessionIdFromRefreshToken(refreshToken: string): string {
    const [sessionId, secret, ...rest] = refreshToken.split(".");
    if (!uuidPattern.test(sessionId ?? "") || !secret || rest.length > 0) {
      throw new ForbiddenException("CSRF validation failed");
    }
    return sessionId;
  }

  private sign(payload: string): string {
    return createHmac(
      "sha256",
      Buffer.from(String(this.config.get("CSRF_SECRET", { infer: true })), "base64url")
    ).update(payload).digest("base64url");
  }
}
