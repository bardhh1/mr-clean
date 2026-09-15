import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import type { EntityManager, Repository } from "typeorm";
import type { AppEnvironment } from "../config/env.validation";
import type { OrderItemEntity } from "../orders/entities/order-item.entity";
import type { OrderEntity, OrderStatus } from "../orders/entities/order.entity";
import { orderCreatedMessages, orderStatusMessages, type EmailMessage } from "./email-templates";
import { EmailOutboxEntity } from "./entities/email-outbox.entity";

@Injectable()
export class EmailOutboxService {
  constructor(
    @InjectRepository(EmailOutboxEntity)
    private readonly outbox: Repository<EmailOutboxEntity>,
    private readonly config: ConfigService<AppEnvironment, true>
  ) {}

  async enqueueOrderCreated(
    manager: EntityManager,
    order: OrderEntity,
    items: OrderItemEntity[]
  ): Promise<void> {
    await this.insertMessages(manager, order, orderCreatedMessages(
      order,
      items,
      this.config.get("ORDER_OWNER_EMAIL", { infer: true })
    ));
  }

  async enqueueOrderStatusChanged(
    manager: EntityManager,
    order: OrderEntity,
    previousStatus: OrderStatus
  ): Promise<void> {
    await this.insertMessages(manager, order, orderStatusMessages(
      order,
      previousStatus,
      this.config.get("ORDER_OWNER_EMAIL", { infer: true })
    ));
  }

  async claimBatch(): Promise<EmailOutboxEntity[]> {
    const batchSize = this.config.get("EMAIL_OUTBOX_BATCH_SIZE", { infer: true });
    const maxAttempts = this.config.get("EMAIL_OUTBOX_MAX_ATTEMPTS", { infer: true });
    const lockTimeout = this.config.get("EMAIL_OUTBOX_LOCK_TIMEOUT_SECONDS", { infer: true });
    const lockToken = randomUUID();

    return this.outbox.manager.transaction(async (manager) => {
      await manager.query(`
        UPDATE "email_outbox"
        SET "status" = 'failed', "locked_at" = NULL, "lock_token" = NULL,
            "last_error" = 'Delivery lease expired after the final attempt',
            "updated_at" = clock_timestamp()
        WHERE "status" = 'processing'
          AND "locked_at" <= clock_timestamp() - ($1 * interval '1 second')
          AND "attempts" >= $2
      `, [lockTimeout, maxAttempts]);

      return manager.query<EmailOutboxEntity[]>(`
        WITH candidates AS (
          SELECT "id"
          FROM "email_outbox"
          WHERE (
            ("status" = 'pending' AND "available_at" <= clock_timestamp())
            OR ("status" = 'processing'
              AND "locked_at" <= clock_timestamp() - ($1 * interval '1 second'))
          )
          AND "attempts" < $2
          ORDER BY "available_at" ASC, "created_at" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $3
        )
        UPDATE "email_outbox" AS job
        SET "status" = 'processing', "attempts" = job."attempts" + 1,
            "locked_at" = clock_timestamp(), "lock_token" = $4,
            "updated_at" = clock_timestamp()
        FROM candidates
        WHERE job."id" = candidates."id"
        RETURNING job.*
      `, [lockTimeout, maxAttempts, batchSize, lockToken]);
    });
  }

  async markSent(job: EmailOutboxEntity, providerMessageId: string): Promise<boolean> {
    const result = await this.outbox.createQueryBuilder()
      .update(EmailOutboxEntity)
      .set({
        status: "sent",
        provider_message_id: providerMessageId,
        sent_at: () => "clock_timestamp()",
        locked_at: null,
        lock_token: null,
        last_error: null
      })
      .where("id = :id AND status = 'processing' AND lock_token = :lockToken", {
        id: job.id,
        lockToken: job.lock_token
      })
      .execute();
    return result.affected === 1;
  }

  async markFailed(job: EmailOutboxEntity, error: string, retryable: boolean): Promise<"retry" | "failed"> {
    const maxAttempts = this.config.get("EMAIL_OUTBOX_MAX_ATTEMPTS", { infer: true });
    const shouldRetry = retryable && job.attempts < maxAttempts;
    const baseSeconds = this.config.get("EMAIL_OUTBOX_BASE_RETRY_SECONDS", { infer: true });
    const delaySeconds = Math.min(baseSeconds * (2 ** Math.max(0, job.attempts - 1)), 21_600);
    const result = await this.outbox.createQueryBuilder()
      .update(EmailOutboxEntity)
      .set({
        status: shouldRetry ? "pending" : "failed",
        available_at: shouldRetry
          ? () => "clock_timestamp() + (:delaySeconds * interval '1 second')"
          : job.available_at,
        locked_at: null,
        lock_token: null,
        last_error: sanitizeError(error)
      })
      .where("id = :id AND status = 'processing' AND lock_token = :lockToken", {
        id: job.id,
        lockToken: job.lock_token,
        delaySeconds
      })
      .execute();
    return result.affected === 1 && shouldRetry ? "retry" : "failed";
  }

  private async insertMessages(
    manager: EntityManager,
    order: OrderEntity,
    messages: EmailMessage[]
  ): Promise<void> {
    if (messages.length === 0) return;
    const fromAddress = this.config.get("EMAIL_FROM", { infer: true });
    await manager.getRepository(EmailOutboxEntity).insert(messages.map((message) => ({
      id: randomUUID(),
      deduplication_key: message.deduplicationKey,
      event_type: message.eventType,
      aggregate_type: "order" as const,
      aggregate_id: order.id,
      from_address: fromAddress,
      recipient: message.recipient,
      reply_to: message.replyTo,
      subject: message.subject,
      text_body: message.textBody,
      html_body: message.htmlBody,
      status: "pending" as const,
      attempts: 0,
      locked_at: null,
      lock_token: null,
      provider_message_id: null,
      last_error: null,
      sent_at: null
    })));
  }
}

function sanitizeError(error: string): string {
  return error.replace(/\s+/g, " ").trim().slice(0, 1_000) || "Email delivery failed";
}
