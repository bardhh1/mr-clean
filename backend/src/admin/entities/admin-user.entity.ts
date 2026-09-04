import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { AdminSessionEntity } from "./admin-session.entity";

export type AdminRole = "admin";

@Entity({ name: "admin_users" })
export class AdminUserEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "text" })
  email!: string;

  @Column({ type: "text" })
  password_hash!: string;

  @Column({ type: "text", default: "admin" })
  role!: AdminRole;

  @Column({ type: "boolean", default: true })
  is_active!: boolean;

  @Column({ type: "integer", default: 0 })
  failed_login_count!: number;

  @Column({ type: "timestamptz", nullable: true })
  last_failed_login_at!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  locked_until!: Date | null;

  @Column({ type: "timestamptz", default: () => "CURRENT_TIMESTAMP" })
  password_changed_at!: Date;

  @Column({ type: "timestamptz", nullable: true })
  last_login_at!: Date | null;

  @Column({ type: "boolean", default: false })
  mfa_enabled!: boolean;

  @Column({ type: "text", nullable: true })
  mfa_secret_ciphertext!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  mfa_enrolled_at!: Date | null;

  @Column({ type: "bigint", nullable: true, transformer: {
    to: (value: number | null) => value,
    from: (value: string | null) => value === null ? null : Number(value)
  } })
  last_totp_counter!: number | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @OneToMany(() => AdminSessionEntity, (session) => session.user)
  sessions?: AdminSessionEntity[];
}
