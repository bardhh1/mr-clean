import type { MigrationInterface, QueryRunner } from "typeorm";

export class CashOnDeliveryCheckout1789516800000 implements MigrationInterface {
  name = "CashOnDeliveryCheckout1789516800000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "customer_email" text`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "legacy_payment_preference" text`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "checkout_version" smallint NOT NULL DEFAULT 2`);

    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "ck_orders_payment"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "ck_orders_status"`);
    await queryRunner.query(`
      UPDATE "orders"
      SET
        "checkout_version" = 1,
        "legacy_payment_preference" = "payment_preference",
        "payment_preference" = 'cash_on_delivery',
        "status" = CASE
          WHEN "status" = 'pending_whatsapp' THEN 'pending'
          WHEN "status" = 'completed' THEN 'delivered'
          ELSE "status"
        END
    `);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "payment_preference" SET DEFAULT 'cash_on_delivery'`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'`);
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD CONSTRAINT "ck_orders_payment" CHECK ("payment_preference" = 'cash_on_delivery'),
      ADD CONSTRAINT "ck_orders_legacy_payment" CHECK (
        ("checkout_version" = 1 AND "legacy_payment_preference" IN ('cash', 'bank_transfer'))
        OR ("checkout_version" = 2 AND "legacy_payment_preference" IS NULL)
      ),
      ADD CONSTRAINT "ck_orders_checkout_version" CHECK ("checkout_version" IN (1, 2)),
      ADD CONSTRAINT "ck_orders_customer_email" CHECK (
        ("checkout_version" = 1 AND "customer_email" IS NULL)
        OR ("checkout_version" = 2 AND "customer_email" IS NOT NULL
          AND length("customer_email") BETWEEN 3 AND 254)
      ),
      ADD CONSTRAINT "ck_orders_status" CHECK (
        "status" IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
      )
    `);

    await queryRunner.query(`
      CREATE FUNCTION "prevent_order_financial_mutation"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'orders with financial snapshots cannot be deleted';
        END IF;
        IF ROW(NEW."total_cents", NEW."currency", NEW."payment_preference",
          NEW."legacy_payment_preference", NEW."checkout_version") IS DISTINCT FROM
          ROW(OLD."total_cents", OLD."currency", OLD."payment_preference",
          OLD."legacy_payment_preference", OLD."checkout_version") THEN
          RAISE EXCEPTION 'order financial snapshots are immutable';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_orders_financial_immutable"
      BEFORE UPDATE OR DELETE ON "orders"
      FOR EACH ROW EXECUTE FUNCTION "prevent_order_financial_mutation"()
    `);
    await queryRunner.query(`
      CREATE FUNCTION "prevent_order_item_snapshot_mutation"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'order item snapshots cannot be deleted';
        END IF;
        IF ROW(NEW."order_id", NEW."sort_order", NEW."name_snapshot", NEW."unit_snapshot",
          NEW."quantity", NEW."unit_price_cents", NEW."line_total_cents") IS DISTINCT FROM
          ROW(OLD."order_id", OLD."sort_order", OLD."name_snapshot", OLD."unit_snapshot",
          OLD."quantity", OLD."unit_price_cents", OLD."line_total_cents") THEN
          RAISE EXCEPTION 'order item snapshots are immutable';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_order_items_snapshot_immutable"
      BEFORE UPDATE OR DELETE ON "order_items"
      FOR EACH ROW EXECUTE FUNCTION "prevent_order_item_snapshot_mutation"()
    `);

    await queryRunner.query(`
      CREATE TABLE "email_outbox" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "deduplication_key" varchar(200) NOT NULL,
        "event_type" text NOT NULL,
        "aggregate_type" text NOT NULL,
        "aggregate_id" uuid NOT NULL,
        "from_address" varchar(320) NOT NULL,
        "recipient" varchar(254) NOT NULL,
        "reply_to" varchar(254),
        "subject" varchar(300) NOT NULL,
        "text_body" text NOT NULL,
        "html_body" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "available_at" timestamptz NOT NULL DEFAULT now(),
        "locked_at" timestamptz,
        "lock_token" uuid,
        "provider_message_id" varchar(200),
        "last_error" varchar(1000),
        "sent_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_email_outbox" PRIMARY KEY ("id"),
        CONSTRAINT "uq_email_outbox_deduplication_key" UNIQUE ("deduplication_key"),
        CONSTRAINT "ck_email_outbox_event_type" CHECK ("event_type" IN (
          'order.created.customer', 'order.created.owner',
          'order.status.customer', 'order.status.owner'
        )),
        CONSTRAINT "ck_email_outbox_aggregate_type" CHECK ("aggregate_type" = 'order'),
        CONSTRAINT "ck_email_outbox_status" CHECK ("status" IN ('pending', 'processing', 'sent', 'failed')),
        CONSTRAINT "ck_email_outbox_attempts" CHECK ("attempts" >= 0),
        CONSTRAINT "ck_email_outbox_processing_lock" CHECK (
          ("status" = 'processing' AND "locked_at" IS NOT NULL AND "lock_token" IS NOT NULL)
          OR ("status" <> 'processing' AND "locked_at" IS NULL AND "lock_token" IS NULL)
        ),
        CONSTRAINT "ck_email_outbox_sent" CHECK (
          ("status" = 'sent' AND "sent_at" IS NOT NULL AND "provider_message_id" IS NOT NULL)
          OR ("status" <> 'sent' AND "sent_at" IS NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_email_outbox_dispatch"
      ON "email_outbox" ("status", "available_at", "created_at")
      WHERE "status" IN ('pending', 'processing')
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_email_outbox_aggregate"
      ON "email_outbox" ("aggregate_type", "aggregate_id", "created_at")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "email_outbox"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_order_items_snapshot_immutable" ON "order_items"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "prevent_order_item_snapshot_mutation"()`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_orders_financial_immutable" ON "orders"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS "prevent_order_financial_mutation"()`);

    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "ck_orders_status"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "ck_orders_customer_email"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "ck_orders_checkout_version"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "ck_orders_legacy_payment"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "ck_orders_payment"`);
    await queryRunner.query(`
      UPDATE "orders"
      SET
        "payment_preference" = COALESCE("legacy_payment_preference", 'cash'),
        "status" = CASE
          WHEN "status" = 'pending' THEN 'pending_whatsapp'
          WHEN "status" IN ('processing', 'shipped') THEN 'confirmed'
          WHEN "status" = 'delivered' THEN 'completed'
          ELSE "status"
        END
    `);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "payment_preference" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending_whatsapp'`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "checkout_version"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "legacy_payment_preference"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customer_email"`);
    await queryRunner.query(`
      ALTER TABLE "orders"
      ADD CONSTRAINT "ck_orders_payment" CHECK ("payment_preference" IN ('cash', 'bank_transfer')),
      ADD CONSTRAINT "ck_orders_status" CHECK (
        "status" IN ('pending_whatsapp', 'confirmed', 'completed', 'cancelled')
      )
    `);
  }
}
