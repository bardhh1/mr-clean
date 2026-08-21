import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { AdminSessionEntity } from "./admin-session.entity";

export type AdminRole = "admin" | "editor";

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

  @Column({ type: "timestamptz", nullable: true })
  last_login_at!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at!: Date;

  @OneToMany(() => AdminSessionEntity, (session) => session.user)
  sessions?: AdminSessionEntity[];
}
