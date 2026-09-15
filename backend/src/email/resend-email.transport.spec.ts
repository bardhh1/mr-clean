import type { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppEnvironment } from "../config/env.validation";
import type { EmailOutboxEntity } from "./entities/email-outbox.entity";
import { EmailDeliveryError, ResendEmailTransport } from "./resend-email.transport";

const config = {
  get: vi.fn().mockReturnValue("re_test_key_12345678")
} as unknown as ConfigService<AppEnvironment, true>;

const job = {
  deduplication_key: "order:one:created:customer",
  from_address: "Mr. Clean <orders@example.com>",
  recipient: "buyer@example.com",
  reply_to: "owner@example.com",
  subject: "Subject",
  html_body: "<p>Body</p>",
  text_body: "Body"
} as EmailOutboxEntity;

describe("ResendEmailTransport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends a stable idempotent request and returns the provider ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ id: "email-provider-id" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new ResendEmailTransport(config).send(job)).resolves.toBe("email-provider-id");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.resend.com/emails");
    const request = fetchMock.mock.calls[0]?.[1] as unknown as RequestInit;
    expect(request.method).toBe("POST");
    expect(request.headers).toMatchObject({ "Idempotency-Key": job.deduplication_key });
    expect(JSON.parse(request.body as string) as unknown).toMatchObject({
      from: job.from_address,
      to: [job.recipient],
      reply_to: job.reply_to
    });
  });

  it("classifies throttling as retryable and validation errors as permanent", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ name: "rate_limit_exceeded", message: "Slow down" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    )));
    await expect(new ResendEmailTransport(config).send(job)).rejects.toMatchObject({
      retryable: true
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ name: "validation_error", message: "Bad recipient" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    )));
    await expect(new ResendEmailTransport(config).send(job)).rejects.toMatchObject({
      retryable: false
    });
  });

  it("treats network failures and malformed success responses as retryable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(new ResendEmailTransport(config).send(job)).rejects.toBeInstanceOf(EmailDeliveryError);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })));
    await expect(new ResendEmailTransport(config).send(job)).rejects.toMatchObject({
      retryable: true
    });
  });
});
