import type { MigrationInterface, QueryRunner } from "typeorm";

export class AdminAuth1787356801000 implements MigrationInterface {
  name = "AdminAuth1787356801000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "password_hash" text NOT NULL,
        "role" text NOT NULL DEFAULT 'admin',
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_admin_users" PRIMARY KEY ("id"),
        CONSTRAINT "ck_admin_users_email_lowercase" CHECK ("email" = lower("email")),
        CONSTRAINT "ck_admin_users_role" CHECK ("role" IN ('admin', 'editor'))
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_admin_users_email" ON "admin_users" (lower("email"))`);

    await queryRunner.query(`
      CREATE TABLE "admin_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "admin_user_id" uuid NOT NULL,
        "token_hash" char(64) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "last_used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_admin_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "fk_admin_sessions_user" FOREIGN KEY ("admin_user_id")
          REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_admin_sessions_user" ON "admin_sessions" ("admin_user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_admin_sessions_active_expiry" ON "admin_sessions" ("expires_at") WHERE "revoked_at" IS NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_sessions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_users"`);
  }
}
