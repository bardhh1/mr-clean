import type { MigrationInterface, QueryRunner } from "typeorm";

export class DashboardMetrics1790035200000 implements MigrationInterface {
  name = "DashboardMetrics1790035200000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamptz`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamptz`);
    await queryRunner.query(`
      UPDATE "orders"
      SET
        "delivered_at" = CASE WHEN "status" = 'delivered' THEN "updated_at" ELSE NULL END,
        "cancelled_at" = CASE WHEN "status" = 'cancelled' THEN "updated_at" ELSE NULL END
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD CONSTRAINT "ck_orders_terminal_timestamps" CHECK (
        ("status" = 'delivered' AND "delivered_at" IS NOT NULL AND "cancelled_at" IS NULL)
        OR ("status" = 'cancelled' AND "cancelled_at" IS NOT NULL AND "delivered_at" IS NULL)
        OR ("status" NOT IN ('delivered', 'cancelled')
          AND "delivered_at" IS NULL AND "cancelled_at" IS NULL)
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "enforce_order_terminal_timestamps"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF TG_OP = 'UPDATE' THEN
          IF OLD."status" = 'delivered' AND (
            NEW."status" <> OLD."status"
            OR NEW."delivered_at" IS DISTINCT FROM OLD."delivered_at"
            OR NEW."cancelled_at" IS DISTINCT FROM OLD."cancelled_at"
          ) THEN
            RAISE EXCEPTION 'delivered order terminal state is immutable';
          END IF;
          IF OLD."status" = 'cancelled' AND (
            NEW."status" <> OLD."status"
            OR NEW."delivered_at" IS DISTINCT FROM OLD."delivered_at"
            OR NEW."cancelled_at" IS DISTINCT FROM OLD."cancelled_at"
          ) THEN
            RAISE EXCEPTION 'cancelled order terminal state is immutable';
          END IF;

          IF NEW."status" IS DISTINCT FROM OLD."status" AND NOT (
            (OLD."status" = 'pending' AND NEW."status" IN ('confirmed', 'cancelled'))
            OR (OLD."status" = 'confirmed' AND NEW."status" IN ('processing', 'cancelled'))
            OR (OLD."status" = 'processing' AND NEW."status" IN ('shipped', 'cancelled'))
            OR (OLD."status" = 'shipped' AND NEW."status" IN ('delivered', 'cancelled'))
          ) THEN
            RAISE EXCEPTION 'invalid order status transition from % to %', OLD."status", NEW."status";
          END IF;
        END IF;

        IF NEW."status" = 'delivered' THEN
          NEW."delivered_at" = COALESCE(NEW."delivered_at", clock_timestamp());
          NEW."cancelled_at" = NULL;
        ELSIF NEW."status" = 'cancelled' THEN
          NEW."cancelled_at" = COALESCE(NEW."cancelled_at", clock_timestamp());
          NEW."delivered_at" = NULL;
        ELSE
          NEW."delivered_at" = NULL;
          NEW."cancelled_at" = NULL;
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_orders_terminal_timestamps"
      BEFORE INSERT OR UPDATE OF "status", "delivered_at", "cancelled_at" ON "orders"
      FOR EACH ROW EXECUTE FUNCTION "enforce_order_terminal_timestamps"()
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_orders_delivered_at"
      ON "orders" ("delivered_at" DESC)
      WHERE "status" = 'delivered'
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_orders_created_status"
      ON "orders" ("created_at" DESC, "status")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_created_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_orders_delivered_at"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_orders_terminal_timestamps" ON "orders"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "enforce_order_terminal_timestamps"()`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "ck_orders_terminal_timestamps"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "cancelled_at"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "delivered_at"`);
  }
}
