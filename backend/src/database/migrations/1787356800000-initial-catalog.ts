import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialCatalog1787356800000 implements MigrationInterface {
  name = "InitialCatalog1787356800000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pg_trgm"`);

    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text,
        "sort_order" integer NOT NULL DEFAULT 99,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_categories" PRIMARY KEY ("id"),
        CONSTRAINT "uq_categories_slug" UNIQUE ("slug"),
        CONSTRAINT "ck_categories_sort_order" CHECK ("sort_order" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "category_id" uuid NOT NULL,
        "name" text NOT NULL,
        "slug" text NOT NULL,
        "description" text NOT NULL,
        "price_cents" integer NOT NULL DEFAULT 0,
        "currency" char(3) NOT NULL DEFAULT 'EUR',
        "unit" text NOT NULL,
        "image_urls" text[] NOT NULL DEFAULT '{}',
        "image_keys" text[] NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "is_featured" boolean NOT NULL DEFAULT false,
        "requires_quote" boolean NOT NULL DEFAULT false,
        "stock_label" text NOT NULL DEFAULT 'Në stok',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_products" PRIMARY KEY ("id"),
        CONSTRAINT "uq_products_slug" UNIQUE ("slug"),
        CONSTRAINT "ck_products_price" CHECK ("price_cents" >= 0),
        CONSTRAINT "ck_products_currency" CHECK ("currency" = 'EUR'),
        CONSTRAINT "fk_products_category" FOREIGN KEY ("category_id")
          REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_categories_active_sort" ON "categories" ("sort_order", "name") WHERE "is_active" = true`);
    await queryRunner.query(`CREATE INDEX "idx_products_category" ON "products" ("category_id")`);
    await queryRunner.query(`CREATE INDEX "idx_products_active_name" ON "products" ("name") WHERE "is_active" = true`);
    await queryRunner.query(`CREATE INDEX "idx_products_active_featured" ON "products" ("is_featured", "name") WHERE "is_active" = true`);
    await queryRunner.query(`CREATE INDEX "idx_products_name_trgm" ON "products" USING gin ("name" gin_trgm_ops)`);
    await queryRunner.query(`CREATE INDEX "idx_products_description_trgm" ON "products" USING gin ("description" gin_trgm_ops)`);

    await queryRunner.query(`
      INSERT INTO "categories" ("id", "name", "slug", "description", "sort_order") VALUES
        ('11111111-1111-4111-8111-111111111111', 'Peceta dhe letër', 'peceta-leter', 'Peceta tavoline, letër kuzhine dhe letër higjienike për përdorim profesional.', 1),
        ('11111111-1111-4111-8111-222222222222', 'Kimikate pastrimi', 'kimikate-pastrimi', 'Detergjentë, dezinfektues dhe produkte për sipërfaqe profesionale.', 2),
        ('11111111-1111-4111-8111-333333333333', 'Aroma dhe aparate', 'aroma-aparate', 'Spray, aroma ambienti dhe aparate me avull për hapësira biznesi.', 3),
        ('11111111-1111-4111-8111-444444444444', 'Hotelieri', 'hotelieri', 'Shampo, sapunë, pajisje dhome dhe produkte të vogla për hotele.', 4)
      ON CONFLICT ("slug") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "products" (
        "id", "category_id", "name", "slug", "description", "price_cents",
        "unit", "image_urls", "is_featured", "stock_label"
      ) VALUES
        ('21111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Peceta të bardha 33x33', 'peceta-te-bardha-33x33', 'Pako profesionale për restorante, kafiteri dhe evente me përdorim të shpeshtë.', 240, 'pako', ARRAY['/products/napkins-pack.png'], true, 'Në stok'),
        ('21111111-1111-4111-8111-222222222222', '11111111-1111-4111-8111-222222222222', 'Detergjent dyshemeje 5L', 'detergjent-dyshemeje-5l', 'Formulë për pastrim ditor të dyshemeve në ambiente biznesi dhe kuzhina.', 890, 'bidon 5L', ARRAY['/products/floor-cleaner-5l.png'], true, 'Në stok'),
        ('21111111-1111-4111-8111-333333333333', '11111111-1111-4111-8111-222222222222', 'Dezinfektues sipërfaqesh 1L', 'dezinfektues-siperfaqesh-1l', 'Për tavolina, banakë, kuzhina dhe hapësira ku higjiena duhet të jetë konstante.', 450, 'shishe', ARRAY['/products/disinfectant-1l.png'], false, 'Në stok'),
        ('21111111-1111-4111-8111-444444444444', '11111111-1111-4111-8111-333333333333', 'Aparat arome me avull', 'aparat-arome-me-avull', 'Aparat për aromatizim ambienti në recepsione, zyra, lokale dhe hotele.', 3990, 'copë', ARRAY['/products/aroma-machine.png'], true, 'Në stok'),
        ('21111111-1111-4111-8111-555555555555', '11111111-1111-4111-8111-333333333333', 'Aromë ambienti 250ml', 'arome-ambienti-250ml', 'Rimbushje për aparat arome, e përshtatshme për ambiente me qarkullim të lartë.', 630, 'shishe', ARRAY['/products/aroma-bottle-250ml.png'], false, 'Në stok'),
        ('21111111-1111-4111-8111-666666666666', '11111111-1111-4111-8111-444444444444', 'Shampo hoteli 30ml', 'shampo-hoteli-30ml', 'Format ekonomik për dhoma hoteli, bujtina dhe apartamente me qira.', 55, 'copë', ARRAY['/products/hotel-shampoo-30ml.png'], false, 'Porosi shumice')
      ON CONFLICT ("slug") DO NOTHING
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "products"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categories"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "pg_trgm"`);
  }
}
