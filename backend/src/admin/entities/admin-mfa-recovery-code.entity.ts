import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import { AdminUserEntity } from "./admin-user.entity";

@Entity({ name: "admin_mfa_recovery_codes" })
@Index("uq_admin_mfa_recovery_code", ["admin_user_id", "code_hash"], { unique: true })
export class AdminMfaRecoveryCodeEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid" })
  admin_user_id!: string;

  @Column({ type: "char", length: 64 })
  code_hash!: string;

  @Column({ type: "timestamptz", nullable: true })
  used_at!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @ManyToOne(() => AdminUserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "admin_user_id" })
  user?: AdminUserEntity;
}
