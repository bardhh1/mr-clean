import { In, type EntityManager } from "typeorm";
import { AdminMfaChallengeEntity } from "../admin/entities/admin-mfa-challenge.entity";
import { AdminMfaRecoveryCodeEntity } from "../admin/entities/admin-mfa-recovery-code.entity";
import { AdminSessionEntity } from "../admin/entities/admin-session.entity";
import { AdminUserEntity } from "../admin/entities/admin-user.entity";

export type ReplaceAdminOwnerInput = {
  currentEmail: string;
  newEmail: string;
  passwordHash: string;
  bootstrapTokenHash: string;
  bootstrapExpiresAt: Date;
};

export async function replaceAdminOwner(
  manager: EntityManager,
  input: ReplaceAdminOwnerInput,
  now = new Date()
): Promise<void> {
  const users = manager.getRepository(AdminUserEntity);
  const current = await users.findOne({
    where: { is_active: true },
    lock: { mode: "pessimistic_write" }
  });
  if (!current || current.email !== input.currentEmail) {
    throw new Error("The active owner does not match ADMIN_REPLACE_FROM_EMAIL");
  }

  const existingTarget = await users.findOne({
    where: { email: input.newEmail },
    lock: { mode: "pessimistic_write" }
  });
  if (existingTarget?.id === current.id) {
    throw new Error("The replacement owner must use a different email address");
  }

  current.is_active = false;
  current.mfa_enabled = false;
  current.mfa_secret_ciphertext = null;
  current.mfa_enrolled_at = null;
  current.last_totp_counter = null;
  current.mfa_bootstrap_token_hash = null;
  current.mfa_bootstrap_expires_at = null;
  await users.save(current);

  const replacement = existingTarget ?? users.create({ email: input.newEmail });
  replacement.email = input.newEmail;
  replacement.password_hash = input.passwordHash;
  replacement.role = "admin";
  replacement.is_active = true;
  replacement.failed_login_count = 0;
  replacement.last_failed_login_at = null;
  replacement.locked_until = null;
  replacement.password_changed_at = now;
  replacement.last_login_at = null;
  replacement.mfa_enabled = false;
  replacement.mfa_secret_ciphertext = null;
  replacement.mfa_enrolled_at = null;
  replacement.last_totp_counter = null;
  replacement.mfa_bootstrap_token_hash = input.bootstrapTokenHash;
  replacement.mfa_bootstrap_expires_at = input.bootstrapExpiresAt;
  const savedReplacement = await users.save(replacement);

  const ownerIds = [current.id, savedReplacement.id];
  await manager.getRepository(AdminMfaChallengeEntity).delete({
    admin_user_id: In(ownerIds)
  });
  await manager.getRepository(AdminMfaRecoveryCodeEntity).delete({
    admin_user_id: In(ownerIds)
  });
  await revokeSessions(manager, current.id, now, "owner_disabled");
  await revokeSessions(manager, savedReplacement.id, now, "password_changed");
}

async function revokeSessions(
  manager: EntityManager,
  adminUserId: string,
  now: Date,
  reason: "owner_disabled" | "password_changed"
): Promise<void> {
  await manager.getRepository(AdminSessionEntity)
    .createQueryBuilder()
    .update(AdminSessionEntity)
    .set({ revoked_at: now, revocation_reason: reason })
    .where("admin_user_id = :adminUserId", { adminUserId })
    .andWhere("revoked_at IS NULL")
    .execute();
}
