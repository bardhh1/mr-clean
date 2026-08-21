import dataSource from "../database/data-source";
import { hashPassword } from "../admin/auth/password";
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
    const repository = dataSource.getRepository(AdminUserEntity);
    const existing = await repository.findOneBy({ email });
    const user = existing ?? repository.create({
      email,
      role: "admin",
      is_active: true,
      last_login_at: null
    });
    user.password_hash = hashPassword(password);
    user.is_active = true;
    await repository.save(user);
    console.log(`Admin account is ready: ${email}`);
  } finally {
    await dataSource.destroy();
  }
}

void createAdmin().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
