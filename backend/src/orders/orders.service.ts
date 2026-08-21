import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createHash, randomUUID } from "node:crypto";
import { DataSource, In, QueryFailedError, Repository } from "typeorm";
import { ProductEntity } from "../catalog/entities/product.entity";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import { OrderItemEntity } from "./entities/order-item.entity";
import { OrderEntity, type OrderStatus } from "./entities/order.entity";

const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_whatsapp: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    private readonly dataSource: DataSource
  ) {}

  async create(input: CreateOrderDto) {
    const normalized = normalizeInput(input);
    const requestHash = hashOrderRequest(normalized);
    const existing = await this.orders.findOneBy({ idempotency_key: normalized.idempotency_key });
    if (existing) return this.resolveIdempotent(existing, requestHash);

    try {
      const order = await this.dataSource.transaction(async (manager) => {
        const productRepository = manager.getRepository(ProductEntity);
        const orderRepository = manager.getRepository(OrderEntity);
        const itemRepository = manager.getRepository(OrderItemEntity);
        const productIds = normalized.items.map((item) => item.product_id);
        const products = await productRepository.find({
          where: { id: In(productIds) },
          lock: { mode: "pessimistic_read" }
        });
        const productsById = new Map(products.map((product) => [product.id, product]));

        const unavailable = productIds.filter((id) => {
          const product = productsById.get(id);
          return !product || !product.is_active || product.requires_quote;
        });
        if (unavailable.length > 0) {
          throw new BadRequestException({
            message: "One or more products cannot be ordered directly",
            product_ids: unavailable
          });
        }

        const lines = normalized.items.map((item, index) => {
          const product = productsById.get(item.product_id);
          if (!product) throw new BadRequestException("Product is unavailable");
          return {
            product,
            quantity: item.quantity,
            sortOrder: index,
            lineTotal: product.price_cents * item.quantity
          };
        });
        const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);
        if (!Number.isSafeInteger(total)) {
          throw new BadRequestException("Order total is outside the supported range");
        }

        const entity = orderRepository.create({
          id: randomUUID(),
          reference: createReference(),
          idempotency_key: normalized.idempotency_key,
          request_hash: requestHash,
          customer_name: normalized.customer_name,
          company_name: normalized.company_name,
          phone: normalized.phone,
          city: normalized.city,
          address: normalized.address,
          notes: normalized.notes,
          payment_preference: normalized.payment_preference,
          status: "pending_whatsapp",
          total_cents: total,
          currency: "EUR"
        });
        const saved = await orderRepository.save(entity);
        saved.items = await itemRepository.save(lines.map((line) => itemRepository.create({
          order_id: saved.id,
          product_id: line.product.id,
          sort_order: line.sortOrder,
          name_snapshot: line.product.name,
          unit_snapshot: line.product.unit,
          quantity: line.quantity,
          unit_price_cents: line.product.price_cents,
          line_total_cents: line.lineTotal
        })));
        return saved;
      });

      return publicReceipt(order);
    } catch (error) {
      if (databaseConstraint(error) === "uq_orders_idempotency_key") {
        const winner = await this.orders.findOneBy({
          idempotency_key: normalized.idempotency_key
        });
        if (winner) return this.resolveIdempotent(winner, requestHash);
      }
      throw error;
    }
  }

  async list(query: ListOrdersQueryDto) {
    const builder = this.orders.createQueryBuilder("purchase")
      .orderBy("purchase.created_at", "DESC")
      .skip(query.offset)
      .take(query.limit);

    if (query.status) {
      builder.andWhere("purchase.status = :status", { status: query.status });
    }
    if (query.search?.trim()) {
      builder.andWhere(
        `(purchase.reference ILIKE :search OR purchase.customer_name ILIKE :search
          OR purchase.company_name ILIKE :search OR purchase.phone ILIKE :search)`,
        { search: `%${query.search.trim()}%` }
      );
    }

    const [data, total] = await builder.getManyAndCount();
    return {
      data: data.map(adminOrder),
      meta: {
        total,
        limit: query.limit,
        offset: query.offset,
        has_more: query.offset + data.length < total
      }
    };
  }

  async getById(id: string) {
    const order = await this.orders.findOne({
      where: { id },
      relations: { items: true },
      order: { items: { sort_order: "ASC" } }
    });
    if (!order) throw new NotFoundException("Order was not found");
    return adminOrder(order);
  }

  async updateStatus(id: string, next: OrderStatus) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(OrderEntity);
      const order = await repository.findOne({
        where: { id },
        lock: { mode: "pessimistic_write" }
      });
      if (!order) throw new NotFoundException("Order was not found");
      if (order.status === next) return adminOrder(order);
      if (!allowedTransitions[order.status].includes(next)) {
        throw new ConflictException(`Order cannot move from ${order.status} to ${next}`);
      }

      order.status = next;
      return adminOrder(await repository.save(order));
    });
  }

  private resolveIdempotent(order: OrderEntity, requestHash: string) {
    if (order.request_hash !== requestHash) {
      throw new ConflictException("Idempotency key was already used for another order");
    }
    return publicReceipt(order);
  }
}

function normalizeInput(input: CreateOrderDto) {
  return {
    idempotency_key: input.idempotency_key,
    customer_name: input.customer_name.trim(),
    company_name: input.company_name?.trim() || null,
    phone: input.phone.trim(),
    city: input.city.trim(),
    address: input.address.trim(),
    notes: input.notes?.trim() || null,
    payment_preference: input.payment_preference,
    items: input.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity
    }))
  };
}

function hashOrderRequest(input: ReturnType<typeof normalizeInput>): string {
  const canonical = {
    ...input,
    items: [...input.items].sort((left, right) => left.product_id.localeCompare(right.product_id))
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function createReference(): string {
  return `MC-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

function publicReceipt(order: OrderEntity) {
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    total_cents: order.total_cents,
    currency: order.currency,
    created_at: order.created_at
  };
}

function adminOrder(order: OrderEntity) {
  return {
    id: order.id,
    reference: order.reference,
    customer_name: order.customer_name,
    company_name: order.company_name,
    phone: order.phone,
    city: order.city,
    address: order.address,
    notes: order.notes,
    payment_preference: order.payment_preference,
    status: order.status,
    total_cents: order.total_cents,
    currency: order.currency,
    created_at: order.created_at,
    updated_at: order.updated_at,
    items: order.items?.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      name: item.name_snapshot,
      unit: item.unit_snapshot,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      line_total_cents: item.line_total_cents
    }))
  };
}

function databaseConstraint(error: unknown): string | undefined {
  if (!(error instanceof QueryFailedError)) return undefined;
  return (error.driverError as { constraint?: string }).constraint;
}
