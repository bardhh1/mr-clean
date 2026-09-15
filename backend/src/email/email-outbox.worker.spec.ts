import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import type { AppEnvironment } from "../config/env.validation";
import type { EmailOutboxService } from "./email-outbox.service";
import { EmailOutboxWorker } from "./email-outbox.worker";
import type { EmailOutboxEntity } from "./entities/email-outbox.entity";
import { EmailDeliveryError, type ResendEmailTransport } from "./resend-email.transport";

const job = { id: "job-1", attempts: 1, lock_token: "lease-1" } as EmailOutboxEntity;
const config = {
  get: vi.fn((key: keyof AppEnvironment) => key === "EMAIL_DELIVERY_ENABLED" ? false : 5_000)
} as unknown as ConfigService<AppEnvironment, true>;

describe("EmailOutboxWorker", () => {
  it("records successful delivery and retryable provider failures", async () => {
    const claimBatch = vi.fn().mockResolvedValue([job]);
    const markSent = vi.fn().mockResolvedValue(true);
    const markFailed = vi.fn().mockResolvedValue("retry");
    const outbox = {
      claimBatch,
      markSent,
      markFailed
    } as unknown as EmailOutboxService;
    const send = vi.fn().mockResolvedValueOnce("provider-1");
    const transport = {
      send
    } as unknown as ResendEmailTransport;
    const worker = new EmailOutboxWorker(config, outbox, transport);

    await worker.poll();
    expect(markSent).toHaveBeenCalledWith(job, "provider-1");

    send.mockRejectedValueOnce(new EmailDeliveryError("busy", true));
    await worker.poll();
    expect(markFailed).toHaveBeenCalledWith(job, "busy", true);
  });

  it("keeps polling failures contained and remains usable", async () => {
    const claimBatch = vi.fn().mockRejectedValueOnce(new Error("database unavailable")).mockResolvedValue([]);
    const outbox = {
      claimBatch
    } as unknown as EmailOutboxService;
    const transport = { send: vi.fn() } as unknown as ResendEmailTransport;
    const worker = new EmailOutboxWorker(config, outbox, transport);

    await expect(worker.poll()).resolves.toBeUndefined();
    await expect(worker.poll()).resolves.toBeUndefined();
    expect(claimBatch).toHaveBeenCalledTimes(2);
    worker.onModuleInit();
    worker.onModuleDestroy();
  });
});
