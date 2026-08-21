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
  "pending_whatsapp",
  "confirmed",
  "completed",
  "cancelled"
] as const;

export type OrderStatus = typeof orderStatuses[number];
export type PaymentPreference = "cash" | "bank_transfer";

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

  @Column({ type: "text" })
  city!: string;

  @Column({ type: "text" })
  address!: string;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "text" })
  payment_preference!: PaymentPreference;

  @Index()
  @Column({ type: "text", default: "pending_whatsapp" })
  status!: OrderStatus;

  @Column({ type: "bigint", transformer: bigintNumber })
  total_cents!: number;

  @Column({ type: "char", length: 3, default: "EUR" })
  currency!: "EUR";

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @OneToMany(() => OrderItemEntity, (item) => item.order)
  items?: OrderItemEntity[];
}
