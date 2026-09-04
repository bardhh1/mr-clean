import dataSource from "../database/data-source";
import { verifyPassword } from "../admin/auth/password";
import { AdminMfaChallengeEntity } from "../admin/entities/admin-mfa-challenge.entity";
import { AdminMfaRecoveryCodeEntity } from "../admin/entities/admin-mfa-recovery-code.entity";
import { AdminSessionEntity } from "../admin/entities/admin-session.entity";
import { AdminUserEntity } from "../admin/entities/admin-user.entity";

async function resetAdminMfa(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const confirmation = process.env.MFA_RESET_CONFIRM;
  if (!email || !password || confirmation !== `RESET-MFA-${email}`) {
    throw new Error(
      "Set ADMIN_EMAIL, ADMIN_PASSWORD, and MFA_RESET_CONFIRM=RESET-MFA-<normalized-email>"
    );
  }

  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const users = manager.getRepository(AdminUserEntity);
      const user = await users.findOne({
        where: { email, is_active: true },
        lock: { mode: "pessimistic_write" }
      });
      if (!user || !verifyPassword(password, user.password_hash)) {
        throw new Error("Owner credentials are invalid");
      }

      const now = new Date();
      await manager.getRepository(AdminMfaChallengeEntity).delete({ admin_user_id: user.id });
      await manager.getRepository(AdminMfaRecoveryCodeEntity).delete({ admin_user_id: user.id });
      user.mfa_enabled = false;
      user.mfa_secret_ciphertext = null;
      user.mfa_enrolled_at = null;
      user.last_totp_counter = null;
      user.failed_login_count = 0;
      user.last_failed_login_at = null;
      user.locked_until = null;
      await users.save(user);

      await manager.getRepository(AdminSessionEntity).createQueryBuilder()
        .update(AdminSessionEntity)
        .set({ revoked_at: now, revocation_reason: "mfa_reset" })
        .where("admin_user_id = :adminUserId", { adminUserId: user.id })
        .andWhere("revoked_at IS NULL")
        .execute();
    });
    console.log(`MFA reset completed for ${email}; the next login must enroll again.`);
  } finally {
    await dataSource.destroy();
  }
}

void resetAdminMfa().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
