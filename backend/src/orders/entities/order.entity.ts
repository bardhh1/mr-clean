import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { OrderItemEntity } from "./order-item.entity";

export const orderStatuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled"
] as const;

export type OrderStatus = typeof orderStatuses[number];
export type PaymentPreference = "cash_on_delivery";

const bigintNumber = {
  to: (value: number) => value,
  from: (value: string) => Number(value)
};

@Entity({ name: "orders" })
export class OrderEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "text" })
  reference!: string;

  @Index({ unique: true })
  @Column({ type: "uuid" })
  idempotency_key!: string;

  @Column({ type: "char", length: 64 })
  request_hash!: string;

  @Column({ type: "text" })
  customer_name!: string;

  @Column({ type: "text", nullable: true })
  company_name!: string | null;

  @Column({ type: "text" })
  phone!: string;

  @Column({ type: "text", nullable: true })
  customer_email!: string | null;

  @Column({ type: "text" })
  city!: string;

  @Column({ type: "text" })
  address!: string;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "text" })
  payment_preference!: PaymentPreference;

  @Column({ type: "text", nullable: true })
  legacy_payment_preference!: string | null;

  @Column({ type: "smallint", default: 2 })
  checkout_version!: number;

  @Index()
  @Column({ type: "text", default: "pending" })
  status!: OrderStatus;

  @Column({ type: "bigint", transformer: bigintNumber })
  total_cents!: number;

  @Column({ type: "char", length: 3, default: "EUR" })
  currency!: "EUR";

  @Column({ type: "timestamptz", nullable: true })
  delivered_at!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  cancelled_at!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @OneToMany(() => OrderItemEntity, (item) => item.order)
  items?: OrderItemEntity[];
}
