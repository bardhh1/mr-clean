import { verifyPassword } from "../admin/auth/password";
import { AdminMfaChallengeEntity } from "../admin/entities/admin-mfa-challenge.entity";
import { AdminMfaRecoveryCodeEntity } from "../admin/entities/admin-mfa-recovery-code.entity";
import { AdminSessionEntity } from "../admin/entities/admin-session.entity";
import { AdminUserEntity } from "../admin/entities/admin-user.entity";
import dataSource from "../database/data-source";
import { readMfaBootstrapInput } from "./mfa-bootstrap-input";

async function issueAdminMfaBootstrap(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const confirmation = process.env.MFA_BOOTSTRAP_CONFIRM;
  if (!email || !password || confirmation !== `ISSUE-MFA-BOOTSTRAP-${email}`) {
    throw new Error(
      "Set ADMIN_EMAIL, ADMIN_PASSWORD, MFA_BOOTSTRAP_TOKEN, and MFA_BOOTSTRAP_CONFIRM=ISSUE-MFA-BOOTSTRAP-<normalized-email>"
    );
  }
  const bootstrap = readMfaBootstrapInput();

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
      if (user.mfa_enabled) {
        throw new Error("MFA is already enabled; use the reset procedure only if recovery is required");
      }

      const now = new Date();
      user.mfa_bootstrap_token_hash = bootstrap.tokenHash;
      user.mfa_bootstrap_expires_at = bootstrap.expiresAt;
      user.failed_login_count = 0;
      user.last_failed_login_at = null;
      user.locked_until = null;
      await users.save(user);

      await manager.getRepository(AdminMfaChallengeEntity).delete({ admin_user_id: user.id });
      await manager.getRepository(AdminMfaRecoveryCodeEntity).delete({ admin_user_id: user.id });
      await manager.getRepository(AdminSessionEntity).createQueryBuilder()
        .update(AdminSessionEntity)
        .set({ revoked_at: now, revocation_reason: "mfa_bootstrap_issued" })
        .where("admin_user_id = :adminUserId", { adminUserId: user.id })
        .andWhere("revoked_at IS NULL")
        .execute();
    });
    console.log(
      `One-time MFA bootstrap authorization issued for ${email}; it expires in ${bootstrap.ttlMinutes} minutes.`
    );
  } finally {
    await dataSource.destroy();
  }
}

void issueAdminMfaBootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
