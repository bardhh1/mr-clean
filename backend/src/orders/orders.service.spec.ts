import { BadRequestException, ConflictException } from "@nestjs/common";
import type { DataSource, EntityManager, Repository } from "typeorm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductEntity } from "../catalog/entities/product.entity";
import type { CreateOrderDto } from "./dto/create-order.dto";
import { OrderItemEntity } from "./entities/order-item.entity";
import { OrderEntity } from "./entities/order.entity";
import { OrdersService } from "./orders.service";
import type { AuditService } from "../audit/audit.service";
import type { EmailOutboxService } from "../email/email-outbox.service";
import type { TurnstileService } from "../common/security/turnstile.service";
import type { ConfigService } from "@nestjs/config";
import type { AppEnvironment } from "../config/env.validation";

const audit = {
  record: vi.fn().mockResolvedValue(undefined)
} as unknown as AuditService;
const enqueueOrderCreated = vi.fn().mockResolvedValue(undefined);
const enqueueOrderStatusChanged = vi.fn().mockResolvedValue(undefined);
const emailOutbox = {
  enqueueOrderCreated,
  enqueueOrderStatusChanged
} as unknown as EmailOutboxService;
const verifyTurnstile = vi.fn().mockResolvedValue(undefined);
const turnstile = { verify: verifyTurnstile } as unknown as TurnstileService;
const orderLimits: Partial<AppEnvironment> = {
  ORDER_GLOBAL_LIMIT_PER_HOUR: 60,
  ORDER_RECIPIENT_LIMIT_PER_DAY: 3
};
const config = {
  get: vi.fn((key: keyof AppEnvironment) => orderLimits[key])
} as unknown as ConfigService<AppEnvironment, true>;

const input: CreateOrderDto = {
  idempotency_key: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  customer_name: "Arta Hoxha",
  company_name: "Hotel Arta",
  phone: "+383 44 123 456",
  customer_email: "arta@example.com",
  city: "Prishtinë",
  address: "Rruga e Testit 10",
  notes: "Recepsioni",
  payment_preference: "cash",
  items: [{
    product_id: "21111111-1111-4111-8111-222222222222",
    quantity: 2
  }]
};

function transactionalService(productOverrides: Partial<ProductEntity> = {}) {
  let savedOrder: OrderEntity | undefined;
  const orders = {
    findOneBy: vi.fn().mockImplementation(() => Promise.resolve(savedOrder ?? null))
  } as unknown as Repository<OrderEntity>;
  const product = {
    id: input.items[0].product_id,
    name: "Detergjent dyshemeje 5L",
    unit: "bidon 5L",
    price_cents: 890,
    is_active: true,
    requires_quote: false,
    ...productOverrides
  } as ProductEntity;
  const productRepository = {
    find: vi.fn().mockResolvedValue([product])
  };
  const createOrder = vi.fn((value: Partial<OrderEntity>): OrderEntity => value as OrderEntity);
  const saveOrder = vi.fn((value: OrderEntity): Promise<OrderEntity> => {
    savedOrder = {
      ...value,
      created_at: new Date("2026-08-22T10:00:00.000Z"),
      updated_at: new Date("2026-08-22T10:00:00.000Z")
    };
    return Promise.resolve(savedOrder);
  });
  const orderRepository = {
    create: createOrder,
    save: saveOrder,
    findOneBy: vi.fn().mockResolvedValue(null)
  };
  const createItem = vi.fn(
    (value: Partial<OrderItemEntity>): OrderItemEntity => value as OrderItemEntity
  );
  const saveItems = vi.fn(
    (value: OrderItemEntity[]): Promise<OrderItemEntity[]> => Promise.resolve(value)
  );
  const itemRepository = {
    create: createItem,
    save: saveItems
  };
  const managerQuery = vi.fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ global_count: 0, recipient_count: 0 }]);
  const manager = {
    query: managerQuery,
    getRepository(entity: unknown) {
      if (entity === ProductEntity) return productRepository;
      if (entity === OrderEntity) return orderRepository;
      if (entity === OrderItemEntity) return itemRepository;
      throw new Error("Unexpected repository requested by test");
    }
  } as unknown as EntityManager;
  const transaction = vi.fn(
    (callback: (transactionManager: EntityManager) => Promise<unknown>): Promise<unknown> =>
      callback(manager)
  );
  const dataSource = {
    transaction
  } as unknown as DataSource;

  return {
    service: new OrdersService(orders, dataSource, audit, emailOutbox, turnstile, config),
    transaction,
    manager,
    managerQuery,
    orderRepository,
    itemRepository
  };
}

function existingOrder(status: OrderEntity["status"] = "pending"): OrderEntity {
  return {
    id: "31111111-1111-4111-8111-111111111111",
    reference: "MC-TESTREFERENCE",
    idempotency_key: input.idempotency_key,
    request_hash: "request-hash",
    customer_name: input.customer_name,
    company_name: input.company_name ?? null,
    phone: input.phone,
    customer_email: input.customer_email,
    city: input.city,
    address: input.address,
    notes: input.notes ?? null,
    payment_preference: "cash_on_delivery",
    legacy_payment_preference: null,
    checkout_version: 2,
    status,
    total_cents: 1_780,
    currency: "EUR",
    delivered_at: status === "delivered" ? new Date("2026-08-22T12:00:00.000Z") : null,
    cancelled_at: status === "cancelled" ? new Date("2026-08-22T12:00:00.000Z") : null,
    created_at: new Date("2026-08-22T10:00:00.000Z"),
    updated_at: new Date("2026-08-22T10:00:00.000Z"),
    items: []
  };
}

function administrativeService(order: OrderEntity | null) {
  const builder = {
    orderBy: vi.fn(),
    skip: vi.fn(),
    take: vi.fn(),
    andWhere: vi.fn(),
    getManyAndCount: vi.fn()
  };
  for (const method of ["orderBy", "skip", "take", "andWhere"] as const) {
    builder[method].mockReturnValue(builder);
  }
  builder.getManyAndCount.mockResolvedValue(order ? [[order], 2] : [[], 0]);

  const orders = {
    createQueryBuilder: vi.fn().mockReturnValue(builder),
    findOne: vi.fn().mockResolvedValue(order)
  } as unknown as Repository<OrderEntity>;
  const transactionRepository = {
    findOne: vi.fn().mockResolvedValue(order),
    save: vi.fn().mockImplementation((value: OrderEntity) => Promise.resolve(value))
  };
  const manager = {
    query: vi.fn(),
    getRepository: vi.fn().mockReturnValue(transactionRepository)
  } as unknown as EntityManager;
  const dataSource = {
    transaction: vi.fn(
      (callback: (transactionManager: EntityManager) => Promise<unknown>) => callback(manager)
    )
  } as unknown as DataSource;

  return {
    service: new OrdersService(orders, dataSource, audit, emailOutbox, turnstile, config),
    builder,
    transactionRepository
  };
}

describe("OrdersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prices and snapshots the order from PostgreSQL inside one transaction", async () => {
    const { service, orderRepository, itemRepository } = transactionalService();

    const receipt = await service.create(input);

    expect(receipt.total_cents).toBe(1_780);
    expect(receipt.status).toBe("pending");
    expect(orderRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      total_cents: 1_780,
      customer_name: "Arta Hoxha",
      customer_email: "arta@example.com",
      payment_preference: "cash_on_delivery",
      checkout_version: 2
    }));
    expect(enqueueOrderCreated).toHaveBeenCalledOnce();
    expect(verifyTurnstile).toHaveBeenCalledOnce();
    expect(itemRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      name_snapshot: "Detergjent dyshemeje 5L",
      unit_price_cents: 890,
      quantity: 2,
      line_total_cents: 1_780
    }));
  });

  it("returns the same receipt for an identical idempotent retry", async () => {
    const { service, transaction } = transactionalService();

    const first = await service.create(input);
    const second = await service.create({ ...input });

    expect(second).toEqual(first);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(verifyTurnstile).toHaveBeenCalledTimes(1);
  });

  it("rejects reuse of an idempotency key with a different cart", async () => {
    const { service } = transactionalService();
    await service.create(input);

    await expect(service.create({
      ...input,
      items: [{ ...input.items[0], quantity: 3 }]
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it("refuses inactive or quote-only products", async () => {
    const { service } = transactionalService({ requires_quote: true });

    await expect(service.create(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("enforces the serialized application-wide order budget", async () => {
    const { service, managerQuery } = transactionalService();
    managerQuery
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ global_count: 60, recipient_count: 0 }]);

    await expect(service.create(input)).rejects.toMatchObject({ status: 429 });
    expect(enqueueOrderCreated).not.toHaveBeenCalled();
  });

  it("lists and searches orders with stable pagination metadata", async () => {
    const { service, builder } = administrativeService(existingOrder());

    const result = await service.list({
      status: "pending",
      search: " Arta ",
      limit: 1,
      offset: 0
    });

    expect(builder.andWhere).toHaveBeenCalledTimes(2);
    expect(result.meta).toEqual({ total: 2, limit: 1, offset: 0, has_more: true });
    expect(result.data[0]).toMatchObject({ customer_name: "Arta Hoxha", items: [] });
  });

  it("returns order details and rejects missing order IDs", async () => {
    const order = existingOrder();
    await expect(administrativeService(order).service.getById(order.id))
      .resolves.toMatchObject({ id: order.id });
    await expect(administrativeService(null).service.getById(order.id))
      .rejects.toMatchObject({ status: 404 });
  });

  it("enforces the order status transition graph", async () => {
    const order = existingOrder();
    const { service, transactionRepository } = administrativeService(order);

    await expect(service.updateStatus(order.id, "confirmed"))
      .resolves.toMatchObject({ status: "confirmed" });
    await expect(service.updateStatus(order.id, "confirmed"))
      .resolves.toMatchObject({ status: "confirmed" });
    await expect(service.updateStatus(order.id, "pending"))
      .rejects.toBeInstanceOf(ConflictException);
    expect(transactionRepository.save).toHaveBeenCalledOnce();
    expect(enqueueOrderStatusChanged).toHaveBeenCalledOnce();

    await expect(administrativeService(null).service.updateStatus(order.id, "confirmed"))
      .rejects.toMatchObject({ status: 404 });
  });

  it("sets an immutable business timestamp when entering a terminal state", async () => {
    const delivered = existingOrder("shipped");
    const deliveredTest = administrativeService(delivered);
    await deliveredTest.service.updateStatus(delivered.id, "delivered");
    const savedDelivered = (
      deliveredTest.transactionRepository.save.mock.calls[0]?.[0]
    ) as unknown as OrderEntity | undefined;
    expect(savedDelivered?.delivered_at).toBeInstanceOf(Date);
    expect(savedDelivered?.cancelled_at).toBeNull();

    const cancelled = existingOrder("processing");
    const cancelledTest = administrativeService(cancelled);
    await cancelledTest.service.updateStatus(cancelled.id, "cancelled");
    const savedCancelled = (
      cancelledTest.transactionRepository.save.mock.calls[0]?.[0]
    ) as unknown as OrderEntity | undefined;
    expect(savedCancelled?.delivered_at).toBeNull();
    expect(savedCancelled?.cancelled_at).toBeInstanceOf(Date);
  });
});
