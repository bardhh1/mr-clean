import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

export const emailOutboxStatuses = ["pending", "processing", "sent", "failed"] as const;
export type EmailOutboxStatus = typeof emailOutboxStatuses[number];

export const emailEventTypes = [
  "order.created.customer",
  "order.created.owner",
  "order.status.customer",
  "order.status.owner"
] as const;
export type EmailEventType = typeof emailEventTypes[number];

@Entity({ name: "email_outbox" })
export class EmailOutboxEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 200 })
  deduplication_key!: string;

  @Column({ type: "text" })
  event_type!: EmailEventType;

  @Column({ type: "text" })
  aggregate_type!: "order";

  @Index()
  @Column({ type: "uuid" })
  aggregate_id!: string;

  @Column({ type: "varchar", length: 320 })
  from_address!: string;

  @Column({ type: "varchar", length: 254 })
  recipient!: string;

  @Column({ type: "varchar", length: 254, nullable: true })
  reply_to!: string | null;

  @Column({ type: "varchar", length: 300 })
  subject!: string;

  @Column({ type: "text" })
  text_body!: string;

  @Column({ type: "text" })
  html_body!: string;

  @Index()
  @Column({ type: "text", default: "pending" })
  status!: EmailOutboxStatus;

  @Column({ type: "integer", default: 0 })
  attempts!: number;

  @Index()
  @Column({ type: "timestamptz", default: () => "now()" })
  available_at!: Date;

  @Column({ type: "timestamptz", nullable: true })
  locked_at!: Date | null;

  @Column({ type: "uuid", nullable: true })
  lock_token!: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  provider_message_id!: string | null;

  @Column({ type: "varchar", length: 1_000, nullable: true })
  last_error!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  sent_at!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;
}
