import dataSource from "../database/data-source";
import { hashPassword } from "../admin/auth/password";
import { AdminSessionEntity } from "../admin/entities/admin-session.entity";
import { AdminUserEntity } from "../admin/entities/admin-user.entity";

async function createAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }
  if (!password || password.length < 12 || password.length > 128) {
    throw new Error("ADMIN_PASSWORD must contain 12 to 128 characters");
  }

  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(AdminUserEntity);
      const activeOwner = await repository.findOne({
        where: { is_active: true },
        lock: { mode: "pessimistic_write" }
      });
      if (activeOwner && activeOwner.email !== email) {
        throw new Error(
          `An active owner already exists (${activeOwner.email}); deactivate it explicitly before replacing the identity`
        );
      }

      const existing = activeOwner?.email === email
        ? activeOwner
        : await repository.findOne({
          where: { email },
          lock: { mode: "pessimistic_write" }
        });

      const now = new Date();
      const user = existing ?? repository.create({
        email,
        role: "admin",
        is_active: true,
        failed_login_count: 0,
        last_failed_login_at: null,
        locked_until: null,
        password_changed_at: now,
        last_login_at: null,
        mfa_enabled: false,
        mfa_secret_ciphertext: null,
        mfa_enrolled_at: null,
        last_totp_counter: null
      });
      user.password_hash = hashPassword(password);
      user.role = "admin";
      user.is_active = true;
      user.failed_login_count = 0;
      user.last_failed_login_at = null;
      user.locked_until = null;
      user.password_changed_at = now;
      const saved = await repository.save(user);

      await manager.getRepository(AdminSessionEntity)
        .createQueryBuilder()
        .update(AdminSessionEntity)
        .set({ revoked_at: now, revocation_reason: "password_changed" })
        .where("admin_user_id = :adminUserId", { adminUserId: saved.id })
        .andWhere("revoked_at IS NULL")
        .execute();
    });
    console.log(`Admin account is ready: ${email}`);
  } finally {
    await dataSource.destroy();
  }
}

void createAdmin().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
