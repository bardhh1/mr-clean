import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AppEnvironment } from "../config/env.validation";
import { EmailOutboxService } from "./email-outbox.service";
import { EmailDeliveryError, ResendEmailTransport } from "./resend-email.transport";

@Injectable()
export class EmailOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailOutboxWorker.name);
  private timer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(
    private readonly config: ConfigService<AppEnvironment, true>,
    private readonly outbox: EmailOutboxService,
    private readonly transport: ResendEmailTransport
  ) {}

  onModuleInit(): void {
    if (!this.config.get("EMAIL_DELIVERY_ENABLED", { infer: true })) return;
    void this.poll();
    this.timer = setInterval(
      () => void this.poll(),
      this.config.get("EMAIL_OUTBOX_POLL_INTERVAL_MS", { infer: true })
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async poll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const jobs = await this.outbox.claimBatch();
      for (const job of jobs) {
        try {
          const providerMessageId = await this.transport.send(job);
          const recorded = await this.outbox.markSent(job, providerMessageId);
          if (!recorded) this.logger.warn(`Email job ${job.id} lost its delivery lease`);
        } catch (error) {
          const retryable = error instanceof EmailDeliveryError ? error.retryable : true;
          const message = error instanceof Error ? error.message : "Unknown delivery failure";
          const outcome = await this.outbox.markFailed(job, message, retryable);
          this.logger.warn(`Email job ${job.id} attempt ${job.attempts} ${outcome}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown outbox failure";
      this.logger.error(`Email outbox poll failed: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
