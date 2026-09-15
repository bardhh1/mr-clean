import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppEnvironment } from "../config/env.validation";
import type { EmailOutboxEntity } from "./entities/email-outbox.entity";

const resendEndpoint = "https://api.resend.com/emails";

export class EmailDeliveryError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

@Injectable()
export class ResendEmailTransport {
  constructor(private readonly config: ConfigService<AppEnvironment, true>) {}

  async send(job: EmailOutboxEntity): Promise<string> {
    const response = await fetch(resendEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.get("RESEND_API_KEY", { infer: true })}`,
        "Content-Type": "application/json",
        "Idempotency-Key": job.deduplication_key
      },
      body: JSON.stringify({
        from: job.from_address,
        to: [job.recipient],
        subject: job.subject,
        html: job.html_body,
        text: job.text_body,
        ...(job.reply_to ? { reply_to: job.reply_to } : {})
      }),
      signal: AbortSignal.timeout(10_000)
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Network failure";
      throw new EmailDeliveryError(`Resend request failed: ${message}`, true);
    });

    const payload = await response.json().catch(() => null) as {
      id?: unknown;
      name?: unknown;
      message?: unknown;
    } | null;
    if (!response.ok) {
      const providerCode = typeof payload?.name === "string" ? payload.name : "unknown_error";
      const providerMessage = typeof payload?.message === "string" ? payload.message : "Request rejected";
      const retryable = response.status === 408 || response.status === 429
        || response.status >= 500
        || (response.status === 409 && providerCode === "concurrent_idempotent_requests");
      throw new EmailDeliveryError(
        `Resend ${response.status} ${providerCode}: ${providerMessage}`,
        retryable
      );
    }
    if (typeof payload?.id !== "string" || payload.id.length === 0 || payload.id.length > 200) {
      throw new EmailDeliveryError("Resend response did not contain a valid message ID", true);
    }
    return payload.id;
  }
}
