import type { MigrationInterface, QueryRunner } from "typeorm";

export class BrowserApiHardening1788998400000 implements MigrationInterface {
  name = "BrowserApiHardening1788998400000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_audit_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "action" text NOT NULL,
        "outcome" text NOT NULL,
        "actor_admin_user_id" uuid,
        "session_id" uuid,
        "target_type" text,
        "target_id" text,
        "request_id" varchar(128),
        "ip_hash" char(64),
        "user_agent" varchar(512),
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "occurred_at" timestamptz NOT NULL DEFAULT clock_timestamp(),
        CONSTRAINT "ck_admin_audit_events_action" CHECK (
          "action" ~ '^[a-z][a-z0-9_.]{2,119}$'
        ),
        CONSTRAINT "ck_admin_audit_events_outcome" CHECK (
          "outcome" IN ('success', 'failure')
        ),
        CONSTRAINT "ck_admin_audit_events_target_type" CHECK (
          "target_type" IS NULL OR "target_type" ~ '^[a-z][a-z0-9_]{1,63}$'
        ),
        CONSTRAINT "ck_admin_audit_events_target_id" CHECK (
          "target_id" IS NULL OR length("target_id") BETWEEN 1 AND 128
        ),
        CONSTRAINT "ck_admin_audit_events_metadata" CHECK (
          jsonb_typeof("metadata") = 'object'
          AND octet_length("metadata"::text) <= 16384
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_admin_audit_events_occurred_at"
        ON "admin_audit_events" ("occurred_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_admin_audit_events_action_occurred_at"
        ON "admin_audit_events" ("action", "occurred_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_admin_audit_events_target"
        ON "admin_audit_events" ("target_type", "target_id", "occurred_at" DESC)
        WHERE "target_type" IS NOT NULL AND "target_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE FUNCTION "prevent_admin_audit_event_mutation"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'admin_audit_events is append-only';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_admin_audit_events_no_row_mutation"
      BEFORE UPDATE OR DELETE ON "admin_audit_events"
      FOR EACH ROW EXECUTE FUNCTION "prevent_admin_audit_event_mutation"()
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_admin_audit_events_no_truncate"
      BEFORE TRUNCATE ON "admin_audit_events"
      FOR EACH STATEMENT EXECUTE FUNCTION "prevent_admin_audit_event_mutation"()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_admin_audit_events_no_truncate" ON "admin_audit_events"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_admin_audit_events_no_row_mutation" ON "admin_audit_events"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "prevent_admin_audit_event_mutation"()`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_events"`);
  }
}
