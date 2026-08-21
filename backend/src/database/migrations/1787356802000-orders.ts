import type { MigrationInterface, QueryRunner } from "typeorm";

export class Orders1787356802000 implements MigrationInterface {
  name = "Orders1787356802000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "reference" text NOT NULL,
        "idempotency_key" uuid NOT NULL,
        "request_hash" char(64) NOT NULL,
        "customer_name" text NOT NULL,
        "company_name" text,
        "phone" text NOT NULL,
        "city" text NOT NULL,
        "address" text NOT NULL,
        "notes" text,
        "payment_preference" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending_whatsapp',
        "total_cents" bigint NOT NULL,
        "currency" char(3) NOT NULL DEFAULT 'EUR',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_orders" PRIMARY KEY ("id"),
        CONSTRAINT "uq_orders_reference" UNIQUE ("reference"),
        CONSTRAINT "uq_orders_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "ck_orders_request_hash" CHECK ("request_hash" ~ '^[0-9a-f]{64}$'),
        CONSTRAINT "ck_orders_payment" CHECK ("payment_preference" IN ('cash', 'bank_transfer')),
        CONSTRAINT "ck_orders_status" CHECK ("status" IN ('pending_whatsapp', 'confirmed', 'completed', 'cancelled')),
        CONSTRAINT "ck_orders_total" CHECK ("total_cents" >= 0),
        CONSTRAINT "ck_orders_currency" CHECK ("currency" = 'EUR')
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "order_id" uuid NOT NULL,
        "product_id" uuid,
        "sort_order" smallint NOT NULL,
        "name_snapshot" text NOT NULL,
        "unit_snapshot" text NOT NULL,
        "quantity" integer NOT NULL,
        "unit_price_cents" integer NOT NULL,
        "line_total_cents" bigint NOT NULL,
        CONSTRAINT "pk_order_items" PRIMARY KEY ("id"),
        CONSTRAINT "ck_order_items_sort" CHECK ("sort_order" >= 0),
        CONSTRAINT "ck_order_items_quantity" CHECK ("quantity" BETWEEN 1 AND 999),
        CONSTRAINT "ck_order_items_unit_price" CHECK ("unit_price_cents" >= 0),
        CONSTRAINT "ck_order_items_line_total" CHECK ("line_total_cents" = "unit_price_cents"::bigint * "quantity"),
        CONSTRAINT "uq_order_items_order_sort" UNIQUE ("order_id", "sort_order"),
        CONSTRAINT "fk_order_items_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "fk_order_items_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_orders_status_created" ON "orders" ("status", "created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "idx_orders_created" ON "orders" ("created_at" DESC)`);
    await queryRunner.query(`CREATE INDEX "idx_orders_reference_trgm" ON "orders" USING gin ("reference" gin_trgm_ops)`);
    await queryRunner.query(`CREATE INDEX "idx_orders_customer_trgm" ON "orders" USING gin ("customer_name" gin_trgm_ops)`);
    await queryRunner.query(`CREATE INDEX "idx_orders_company_trgm" ON "orders" USING gin ("company_name" gin_trgm_ops)`);
    await queryRunner.query(`CREATE INDEX "idx_orders_phone_trgm" ON "orders" USING gin ("phone" gin_trgm_ops)`);
    await queryRunner.query(`CREATE INDEX "idx_order_items_order" ON "order_items" ("order_id", "sort_order")`);
    await queryRunner.query(`CREATE INDEX "idx_order_items_product" ON "order_items" ("product_id") WHERE "product_id" IS NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "orders"`);
  }
}
