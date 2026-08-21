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

@Entity({ name: "admin_sessions" })
export class AdminSessionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid" })
  admin_user_id!: string;

  @Column({ type: "char", length: 64 })
  token_hash!: string;

  @Column({ type: "timestamptz" })
  expires_at!: Date;

  @Column({ type: "timestamptz", nullable: true })
  revoked_at!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  last_used_at!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @ManyToOne(() => AdminUserEntity, (user) => user.sessions, {
    onDelete: "CASCADE"
  })
  @JoinColumn({ name: "admin_user_id" })
  user?: AdminUserEntity;
}
