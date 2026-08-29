import type { MigrationInterface, QueryRunner } from "typeorm";

export class SingleOwnerAuthFoundation1788021000000 implements MigrationInterface {
  name = "SingleOwnerAuthFoundation1788021000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF (SELECT count(*) FROM "admin_users" WHERE "is_active") > 1 THEN
          RAISE EXCEPTION 'single-owner migration requires at most one active administrator';
        END IF;
      END
      $$
    `);

    await queryRunner.query(`UPDATE "admin_users" SET "role" = 'admin' WHERE "role" <> 'admin'`);
    await queryRunner.query(`ALTER TABLE "admin_users" DROP CONSTRAINT "ck_admin_users_role"`);
    await queryRunner.query(`
      ALTER TABLE "admin_users"
        ADD CONSTRAINT "ck_admin_users_role" CHECK ("role" = 'admin'),
        ADD COLUMN "failed_login_count" integer NOT NULL DEFAULT 0,
        ADD COLUMN "last_failed_login_at" timestamptz,
        ADD COLUMN "locked_until" timestamptz,
        ADD COLUMN "password_changed_at" timestamptz NOT NULL DEFAULT now(),
        ADD CONSTRAINT "ck_admin_users_failed_login_count"
          CHECK ("failed_login_count" BETWEEN 0 AND 100000)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_admin_users_single_active"
        ON "admin_users" ((true))
        WHERE "is_active"
    `);

    await queryRunner.query(`
      ALTER TABLE "admin_sessions"
        ADD COLUMN "family_id" uuid,
        ADD COLUMN "parent_session_id" uuid,
        ADD COLUMN "rotated_to_session_id" uuid,
        ADD COLUMN "family_expires_at" timestamptz,
        ADD COLUMN "revocation_reason" text,
        ADD COLUMN "compromised_at" timestamptz
    `);
    await queryRunner.query(`
      UPDATE "admin_sessions"
      SET
        "family_id" = "id",
        "family_expires_at" = "expires_at",
        "revocation_reason" = CASE
          WHEN "revoked_at" IS NOT NULL THEN 'logout'
          ELSE NULL
        END
    `);
    await queryRunner.query(`
      ALTER TABLE "admin_sessions"
        ALTER COLUMN "family_id" SET NOT NULL,
        ALTER COLUMN "family_expires_at" SET NOT NULL,
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
        ),
        ADD CONSTRAINT "ck_admin_sessions_parent_not_self"
          CHECK ("parent_session_id" IS NULL OR "parent_session_id" <> "id"),
        ADD CONSTRAINT "ck_admin_sessions_rotation_not_self"
          CHECK ("rotated_to_session_id" IS NULL OR "rotated_to_session_id" <> "id"),
        ADD CONSTRAINT "fk_admin_sessions_parent" FOREIGN KEY ("parent_session_id")
          REFERENCES "admin_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
        ADD CONSTRAINT "fk_admin_sessions_rotated_to" FOREIGN KEY ("rotated_to_session_id")
          REFERENCES "admin_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `);
    await queryRunner.query(`CREATE INDEX "idx_admin_sessions_family" ON "admin_sessions" ("family_id", "created_at")`);
    await queryRunner.query(`
      CREATE INDEX "idx_admin_sessions_user_active"
        ON "admin_sessions" ("admin_user_id", "created_at" DESC)
        WHERE "revoked_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_admin_sessions_user_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_admin_sessions_family"`);
    await queryRunner.query(`ALTER TABLE "admin_sessions" DROP CONSTRAINT IF EXISTS "fk_admin_sessions_rotated_to"`);
    await queryRunner.query(`ALTER TABLE "admin_sessions" DROP CONSTRAINT IF EXISTS "fk_admin_sessions_parent"`);
    await queryRunner.query(`ALTER TABLE "admin_sessions" DROP CONSTRAINT IF EXISTS "ck_admin_sessions_rotation_not_self"`);
    await queryRunner.query(`ALTER TABLE "admin_sessions" DROP CONSTRAINT IF EXISTS "ck_admin_sessions_parent_not_self"`);
    await queryRunner.query(`ALTER TABLE "admin_sessions" DROP CONSTRAINT IF EXISTS "ck_admin_sessions_revocation_reason"`);
    await queryRunner.query(`
      ALTER TABLE "admin_sessions"
        DROP COLUMN "compromised_at",
        DROP COLUMN "revocation_reason",
        DROP COLUMN "family_expires_at",
        DROP COLUMN "rotated_to_session_id",
        DROP COLUMN "parent_session_id",
        DROP COLUMN "family_id"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "uq_admin_users_single_active"`);
    await queryRunner.query(`ALTER TABLE "admin_users" DROP CONSTRAINT IF EXISTS "ck_admin_users_failed_login_count"`);
    await queryRunner.query(`ALTER TABLE "admin_users" DROP CONSTRAINT "ck_admin_users_role"`);
    await queryRunner.query(`
      ALTER TABLE "admin_users"
        DROP COLUMN "password_changed_at",
        DROP COLUMN "locked_until",
        DROP COLUMN "last_failed_login_at",
        DROP COLUMN "failed_login_count",
        ADD CONSTRAINT "ck_admin_users_role" CHECK ("role" IN ('admin', 'editor'))
    `);
  }
}
