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

export const mfaChallengePurposes = ["enrollment", "login"] as const;
export type MfaChallengePurpose = typeof mfaChallengePurposes[number];

@Entity({ name: "admin_mfa_challenges" })
export class AdminMfaChallengeEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "uuid" })
  admin_user_id!: string;

  @Column({ type: "text" })
  purpose!: MfaChallengePurpose;

  @Column({ type: "char", length: 64 })
  token_hash!: string;

  @Column({ type: "text", nullable: true })
  pending_secret_ciphertext!: string | null;

  @Column({ type: "timestamptz" })
  password_changed_at!: Date;

  @Column({ type: "integer", default: 0 })
  failed_attempts!: number;

  @Column({ type: "timestamptz" })
  expires_at!: Date;

  @Column({ type: "timestamptz", nullable: true })
  consumed_at!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  created_at!: Date;

  @ManyToOne(() => AdminUserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "admin_user_id" })
  user?: AdminUserEntity;
}
