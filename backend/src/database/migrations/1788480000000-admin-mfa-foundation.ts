import type { MigrationInterface, QueryRunner } from "typeorm";

export class AdminMfaFoundation1788480000000 implements MigrationInterface {
  name = "AdminMfaFoundation1788480000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "admin_users"
        ADD COLUMN "mfa_enabled" boolean NOT NULL DEFAULT false,
        ADD COLUMN "mfa_secret_ciphertext" text,
        ADD COLUMN "mfa_enrolled_at" timestamptz,
        ADD COLUMN "last_totp_counter" bigint,
        ADD CONSTRAINT "ck_admin_users_mfa_state" CHECK (
          (NOT "mfa_enabled" AND "mfa_secret_ciphertext" IS NULL AND "mfa_enrolled_at" IS NULL)
          OR
          ("mfa_enabled" AND "mfa_secret_ciphertext" IS NOT NULL AND "mfa_enrolled_at" IS NOT NULL)
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "admin_sessions"
        ADD COLUMN "mfa_verified_at" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "admin_sessions"
        DROP CONSTRAINT "ck_admin_sessions_revocation_reason",
        ADD CONSTRAINT "ck_admin_sessions_revocation_reason" CHECK (
          "revocation_reason" IS NULL OR "revocation_reason" IN (
            'rotated',
            'logout',
            'logout_all',
            'reuse_detected',
            'expired',
            'password_changed',
            'mfa_enrollment_required',
            'mfa_reset',
            'owner_disabled'
          )
        )
    `);
    await queryRunner.query(`
      UPDATE "admin_sessions"
      SET "revoked_at" = now(), "revocation_reason" = 'mfa_enrollment_required'
      WHERE "revoked_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_mfa_challenges" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "admin_user_id" uuid NOT NULL,
        "purpose" text NOT NULL,
        "token_hash" char(64) NOT NULL,
        "pending_secret_ciphertext" text,
        "password_changed_at" timestamptz NOT NULL,
        "failed_attempts" integer NOT NULL DEFAULT 0,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_admin_mfa_challenges_user" FOREIGN KEY ("admin_user_id")
          REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "uq_admin_mfa_challenges_token_hash" UNIQUE ("token_hash"),
        CONSTRAINT "ck_admin_mfa_challenges_purpose" CHECK ("purpose" IN ('enrollment', 'login')),
        CONSTRAINT "ck_admin_mfa_challenges_attempts" CHECK ("failed_attempts" BETWEEN 0 AND 100),
        CONSTRAINT "ck_admin_mfa_challenges_secret" CHECK (
          ("purpose" = 'enrollment' AND "pending_secret_ciphertext" IS NOT NULL)
          OR
          ("purpose" = 'login' AND "pending_secret_ciphertext" IS NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_admin_mfa_challenges_user_active"
        ON "admin_mfa_challenges" ("admin_user_id", "created_at" DESC)
        WHERE "consumed_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_mfa_recovery_codes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "admin_user_id" uuid NOT NULL,
        "code_hash" char(64) NOT NULL,
        "used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_admin_mfa_recovery_codes_user" FOREIGN KEY ("admin_user_id")
          REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "uq_admin_mfa_recovery_code" UNIQUE ("admin_user_id", "code_hash")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_admin_mfa_recovery_codes_user_unused"
        ON "admin_mfa_recovery_codes" ("admin_user_id", "created_at")
        WHERE "used_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_admin_mfa_recovery_codes_user_unused"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_mfa_recovery_codes"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_admin_mfa_challenges_user_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_mfa_challenges"`);

    await queryRunner.query(`
      UPDATE "admin_sessions"
      SET "revocation_reason" = 'logout'
      WHERE "revocation_reason" IN ('mfa_enrollment_required', 'mfa_reset')
    `);
    await queryRunner.query(`
      ALTER TABLE "admin_sessions"
        DROP CONSTRAINT "ck_admin_sessions_revocation_reason",
        DROP COLUMN "mfa_verified_at",
        ADD CONSTRAINT "ck_admin_sessions_revocation_reason" CHECK (
          "revocation_reason" IS NULL OR "revocation_reason" IN (
            'rotated',
            'logout',
            'logout_all',
            'reuse_detected',
            'expired',
            'password_changed',
            'owner_disabled'
          )
        )
    `);

    await queryRunner.query(`
      ALTER TABLE "admin_users"
        DROP CONSTRAINT "ck_admin_users_mfa_state",
        DROP COLUMN "last_totp_counter",
        DROP COLUMN "mfa_enrolled_at",
        DROP COLUMN "mfa_secret_ciphertext",
        DROP COLUMN "mfa_enabled"
    `);
  }
}
