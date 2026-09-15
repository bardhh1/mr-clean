import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { AppEnvironment } from "../../config/env.validation";

const verificationUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const failureMessage = "Security verification failed. Please retry.";
const unavailableMessage = "Security verification is temporarily unavailable. Please retry.";

type TurnstileResponse = {
  success?: unknown;
  hostname?: unknown;
  action?: unknown;
  "error-codes"?: unknown;
};

@Injectable()
export class TurnstileService {
  private readonly enabled: boolean;
  private readonly secret: string;
  private readonly expectedHostnames: ReadonlySet<string>;

  constructor(private readonly config: ConfigService<AppEnvironment, true>) {
    this.enabled = config.get("TURNSTILE_ENABLED", { infer: true });
    this.secret = config.get("TURNSTILE_SECRET_KEY", { infer: true });
    this.expectedHostnames = new Set(
      config.get("TURNSTILE_EXPECTED_HOSTNAMES", { infer: true })
        .split(",")
        .map((hostname) => hostname.trim().toLowerCase())
    );
  }

  async verify(token: string | undefined): Promise<void> {
    if (!this.enabled) return;
    if (!token || token.length > 2_048) throw new BadRequestException(failureMessage);

    const idempotencyKey = randomUUID();
    let response: Response;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(verificationUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            secret: this.secret,
            response: token,
            idempotency_key: idempotencyKey
          }),
          signal: AbortSignal.timeout(5_000)
        });
      } catch {
        if (attempt === 0) continue;
        throw new ServiceUnavailableException(unavailableMessage);
      }

      if (response.status >= 500) {
        if (attempt === 0) continue;
        throw new ServiceUnavailableException(unavailableMessage);
      }
      if (!response.ok) throw new BadRequestException(failureMessage);

      let result: TurnstileResponse;
      try {
        result = await response.json() as TurnstileResponse;
      } catch {
        throw new ServiceUnavailableException(unavailableMessage);
      }
      const errorCodes = Array.isArray(result["error-codes"])
        ? result["error-codes"].filter((value): value is string => typeof value === "string")
        : [];
      if (!result.success && errorCodes.includes("internal-error") && attempt === 0) continue;
      if (
        result.success !== true
        || typeof result.hostname !== "string"
        || !this.expectedHostnames.has(result.hostname.toLowerCase())
        || result.action !== "checkout"
      ) {
        throw new BadRequestException(failureMessage);
      }
      return;
    }
    throw new ServiceUnavailableException(unavailableMessage);
  }
}
