import type { ConfigService } from "@nestjs/config";
import type { EntityManager, Repository } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppEnvironment } from "../config/env.validation";
import type { OrderItemEntity } from "../orders/entities/order-item.entity";
import type { OrderEntity } from "../orders/entities/order.entity";
import { EmailOutboxService } from "./email-outbox.service";
import type { EmailOutboxEntity } from "./entities/email-outbox.entity";

const values: Partial<AppEnvironment> = {
  ORDER_OWNER_EMAIL: "owner@example.com",
  EMAIL_FROM: "Mr. Clean <orders@example.com>",
  EMAIL_OUTBOX_BATCH_SIZE: 20,
  EMAIL_OUTBOX_MAX_ATTEMPTS: 3,
  EMAIL_OUTBOX_BASE_RETRY_SECONDS: 30,
  EMAIL_OUTBOX_LOCK_TIMEOUT_SECONDS: 300
};
const config = {
  get: vi.fn((key: keyof AppEnvironment) => values[key])
} as unknown as ConfigService<AppEnvironment, true>;

function order(): OrderEntity {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    reference: "MC-TEST12345678",
    customer_name: "Arta",
    customer_email: "arta@example.com",
    phone: "+38344111222",
    company_name: null,
    city: "Prishtinë",
    address: "Rruga Test",
    notes: null,
    payment_preference: "cash_on_delivery",
    legacy_payment_preference: null,
    checkout_version: 2,
    status: "pending",
    total_cents: 1_000,
    currency: "EUR"
  } as OrderEntity;
}

function updateBuilder(affected = 1) {
  const builder = {
    update: vi.fn(),
    set: vi.fn(),
    where: vi.fn(),
    execute: vi.fn().mockResolvedValue({ affected })
  };
  builder.update.mockReturnValue(builder);
  builder.set.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  return builder;
}

describe("EmailOutboxService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts only the trusted-owner creation message through the transaction manager", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    const manager = {
      getRepository: vi.fn().mockReturnValue({ insert })
    } as unknown as EntityManager;
    const outbox = {} as Repository<EmailOutboxEntity>;
    const service = new EmailOutboxService(outbox, config);

    await service.enqueueOrderCreated(manager, order(), [{
      name_snapshot: "Produkt",
      unit_snapshot: "1L",
      quantity: 1,
      line_total_cents: 1_000
    } as OrderItemEntity]);

    expect(insert).toHaveBeenCalledOnce();
    const inserted = insert.mock.calls[0]?.[0] as unknown as Array<Record<string, unknown>>;
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      aggregate_id: order().id,
      from_address: values.EMAIL_FROM,
      recipient: values.ORDER_OWNER_EMAIL,
      event_type: "order.created.owner",
      status: "pending"
    });
  });

  it("claims ready jobs with bounded attempts and a unique lease", async () => {
    const claimed = [{ id: "job-1", attempts: 1 }];
    const query = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(claimed);
    const manager = { query } as unknown as EntityManager;
    const outbox = {
      manager: {
        transaction: vi.fn((callback: (manager: EntityManager) => unknown) => callback(manager))
      }
    } as unknown as Repository<EmailOutboxEntity>;

    await expect(new EmailOutboxService(outbox, config).claimBatch()).resolves.toEqual(claimed);
    const claimSql = query.mock.calls[1]?.[0] as unknown as string;
    const parameters = query.mock.calls[1]?.[1] as unknown as unknown[];
    expect(claimSql).toContain("FOR UPDATE SKIP LOCKED");
    expect(parameters.slice(0, 3)).toEqual([300, 3, 20]);
    expect(parameters[3]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("unwraps PostgreSQL UPDATE RETURNING results before handing jobs to the worker", async () => {
    const claimed = [{ id: "job-1", attempts: 1 }] as EmailOutboxEntity[];
    const query = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([claimed, claimed.length]);
    const manager = { query } as unknown as EntityManager;
    const outbox = {
      manager: {
        transaction: vi.fn((callback: (manager: EntityManager) => unknown) => callback(manager))
      }
    } as unknown as Repository<EmailOutboxEntity>;

    await expect(new EmailOutboxService(outbox, config).claimBatch()).resolves.toEqual(claimed);
  });

  it("unwraps an empty PostgreSQL UPDATE RETURNING result", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([[], 0]);
    const manager = { query } as unknown as EntityManager;
    const outbox = {
      manager: {
        transaction: vi.fn((callback: (manager: EntityManager) => unknown) => callback(manager))
      }
    } as unknown as Repository<EmailOutboxEntity>;

    await expect(new EmailOutboxService(outbox, config).claimBatch()).resolves.toEqual([]);
  });

  it("marks a leased job sent only when the lease still belongs to this worker", async () => {
    const builder = updateBuilder();
    const outbox = {
      createQueryBuilder: vi.fn().mockReturnValue(builder)
    } as unknown as Repository<EmailOutboxEntity>;
    const service = new EmailOutboxService(outbox, config);
    const job = { id: "job-1", lock_token: "lease-1" } as EmailOutboxEntity;

    await expect(service.markSent(job, "provider-1")).resolves.toBe(true);
    expect(builder.set).toHaveBeenCalledWith(expect.objectContaining({
      status: "sent",
      provider_message_id: "provider-1",
      lock_token: null
    }));
  });

  it("retries transient failures with backoff and permanently fails terminal attempts", async () => {
    const builder = updateBuilder();
    const outbox = {
      createQueryBuilder: vi.fn().mockReturnValue(builder)
    } as unknown as Repository<EmailOutboxEntity>;
    const service = new EmailOutboxService(outbox, config);
    const job = {
      id: "job-1",
      lock_token: "lease-1",
      attempts: 1,
      available_at: new Date(0)
    } as EmailOutboxEntity;

    await expect(service.markFailed(job, "  temporary\nerror  ", true)).resolves.toBe("retry");
    expect(builder.set).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "pending",
      last_error: "temporary error"
    }));

    job.attempts = 3;
    await expect(service.markFailed(job, "permanent", true)).resolves.toBe("failed");
    expect(builder.set).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed" }));
  });
});
