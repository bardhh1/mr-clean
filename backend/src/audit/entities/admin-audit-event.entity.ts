import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "admin_audit_events" })
export class AdminAuditEventEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "text" })
  action!: string;

  @Column({ type: "text" })
  outcome!: "success" | "failure";

  @Column({ type: "uuid", nullable: true })
  actor_admin_user_id!: string | null;

  @Column({ type: "uuid", nullable: true })
  session_id!: string | null;

  @Column({ type: "text", nullable: true })
  target_type!: string | null;

  @Column({ type: "text", nullable: true })
  target_id!: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  request_id!: string | null;

  @Column({ type: "char", length: 64, nullable: true })
  ip_hash!: string | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  user_agent!: string | null;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: "timestamptz" })
  occurred_at!: Date;
}
