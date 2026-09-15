import { hashPassword } from "../admin/auth/password";
import dataSource from "../database/data-source";
import { readMfaBootstrapInput } from "./mfa-bootstrap-input";
import { replaceAdminOwner } from "./replace-admin-owner-operation";

async function run(): Promise<void> {
  const currentEmail = normalizedEmail(process.env.ADMIN_REPLACE_FROM_EMAIL);
  const newEmail = normalizedEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD;
  const confirmation = `REPLACE-ADMIN-${currentEmail}-WITH-${newEmail}`;

  if (currentEmail === newEmail) {
    throw new Error("ADMIN_EMAIL must be different from ADMIN_REPLACE_FROM_EMAIL");
  }
  if (!password || password.length < 12 || password.length > 128) {
    throw new Error("ADMIN_PASSWORD must contain 12 to 128 characters");
  }
  if (process.env.ADMIN_REPLACE_CONFIRM !== confirmation) {
    throw new Error(`Set ADMIN_REPLACE_CONFIRM=${confirmation}`);
  }

  const now = new Date();
  const bootstrap = readMfaBootstrapInput(process.env, now);
  const passwordHash = hashPassword(password);
  await dataSource.initialize();
  try {
    await dataSource.transaction((manager) => replaceAdminOwner(manager, {
      currentEmail,
      newEmail,
      passwordHash,
      bootstrapTokenHash: bootstrap.tokenHash,
      bootstrapExpiresAt: bootstrap.expiresAt
    }, now));
    console.log(
      `Owner replacement completed for ${newEmail}. All previous sessions and MFA credentials were revoked; complete MFA enrollment before the bootstrap authorization expires.`
    );
  } finally {
    await dataSource.destroy();
  }
}

function normalizedEmail(value: string | undefined): string {
  const email = value?.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    throw new Error("ADMIN_REPLACE_FROM_EMAIL and ADMIN_EMAIL must be valid email addresses");
  }
  return email;
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
