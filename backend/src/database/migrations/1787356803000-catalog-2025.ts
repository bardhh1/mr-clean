import type { MigrationInterface, QueryRunner } from "typeorm";

type CatalogProduct = {
  catalog_code: string;
  category_slug: string;
  name: string;
  slug: string;
  description: string;
  price_cents: number;
  unit: string;
  image_url: string;
  is_featured: boolean;
};

export const catalogProducts: CatalogProduct[] = [
  {
    catalog_code: "0001",
    category_slug: "peceta-leter",
    name: "Salveta servimi 33×33 cm",
    slug: "salveta-servimi-33x33",
    description: "Me logo ose pa logo, sipas kërkesës së klientit. Paketimi: 20 × 200 copë.",
    price_cents: 1800,
    unit: "karton (20 × 200 copë)",
    image_url: "/catalog-products/0001-salveta-servimi-33x33.webp",
    is_featured: true
  },
  {
    catalog_code: "0002",
    category_slug: "peceta-leter",
    name: "Salveta servimi 30×30 cm",
    slug: "salveta-servimi-30x30",
    description: "Me logo ose pa logo, sipas kërkesës së klientit. Paketimi: 20 × 200 copë.",
    price_cents: 700,
    unit: "karton (20 × 200 copë)",
    image_url: "/catalog-products/0002-salveta-servimi-30x30.webp",
    is_featured: false
  },
  {
    catalog_code: "0003",
    category_slug: "peceta-leter",
    name: "Fletëza për duar 2-palëshe, 12×200",
    slug: "fleteza-duar-2p-12x200",
    description: "Fletëza profesionale për duar, dy-palëshe. Paketimi: 12 × 200 copë.",
    price_cents: 1500,
    unit: "karton (12 × 200 copë)",
    image_url: "/catalog-products/0003-fleteza-duar-2p-12x200.webp",
    is_featured: false
  },
  {
    catalog_code: "0004",
    category_slug: "peceta-leter",
    name: "Fletëza për duar 2-palëshe, kafe",
    slug: "fleteza-duar-2p-kafe-20x200",
    description: "Fletëza profesionale ngjyrë kafe, dy-palëshe. Paketimi: 20 × 200 copë.",
    price_cents: 1400,
    unit: "karton (20 × 200 copë)",
    image_url: "/catalog-products/0004-fleteza-duar-2p-kafe-20x200.webp",
    is_featured: false
  },
  {
    catalog_code: "0005",
    category_slug: "peceta-leter",
    name: "Fletëza për duar 2-palëshe, 20×200",
    slug: "fleteza-duar-2p-20x200",
    description: "Fletëza profesionale për duar, dy-palëshe. Paketimi: 20 × 200 copë.",
    price_cents: 1900,
    unit: "karton (20 × 200 copë)",
    image_url: "/catalog-products/0005-fleteza-duar-2p-20x200.webp",
    is_featured: false
  },
  {
    catalog_code: "0006",
    category_slug: "peceta-leter",
    name: "Fletëza për tualet 2-palëshe, 24×250",
    slug: "fleteza-tualeti-2p-24x250",
    description: "Fletëza të palosura për tualet, dy-palëshe. Paketimi: 24 × 250 copë.",
    price_cents: 1800,
    unit: "karton (24 × 250 copë)",
    image_url: "/catalog-products/0006-fleteza-tualeti-2p-24x250.webp",
    is_featured: false
  },
  {
    catalog_code: "0007",
    category_slug: "peceta-leter",
    name: "Fletëza për tualet 2-palëshe, 40×200",
    slug: "fleteza-tualeti-2p-40x200",
    description: "Fletëza të palosura për tualet, dy-palëshe. Paketimi: 40 × 200 copë.",
    price_cents: 1900,
    unit: "karton (40 × 200 copë)",
    image_url: "/catalog-products/0007-fleteza-tualeti-2p-40x200.webp",
    is_featured: false
  },
  {
    catalog_code: "0008",
    category_slug: "peceta-leter",
    name: "Rollne për duar 2-palëshe, 700 g",
    slug: "rollne-duar-700g",
    description: "Gjashtë rollne për pako, me peshë 700 g për copë.",
    price_cents: 1400,
    unit: "pako (6 copë)",
    image_url: "/catalog-products/0008-rollne-duar-700g.webp",
    is_featured: false
  },
  {
    catalog_code: "0009",
    category_slug: "peceta-leter",
    name: "Rollne për duar 2-palëshe, 550 g",
    slug: "rollne-duar-550g",
    description: "Gjashtë rollne për pako, me peshë 550 g për copë.",
    price_cents: 800,
    unit: "pako (6 copë)",
    image_url: "/catalog-products/0009-rollne-duar-550g.webp",
    is_featured: false
  },
  {
    catalog_code: "0010",
    category_slug: "peceta-leter",
    name: "Rollne për duar 2-palëshe, 600 g",
    slug: "rollne-duar-600g",
    description: "Gjashtë rollne për pako, me peshë 600 g për copë.",
    price_cents: 1050,
    unit: "pako (6 copë)",
    image_url: "/catalog-products/0010-rollne-duar-600g.webp",
    is_featured: false
  },
  {
    catalog_code: "0011",
    category_slug: "peceta-leter",
    name: "Rollne për shtrat 2-palëshe, 60 cm × 50 m",
    slug: "rollne-shtrati-60cm-50m",
    description: "Rollne higjienike për shtretër trajtimi. Gjashtë copë, 60 cm × 50 m.",
    price_cents: 2400,
    unit: "pako (6 copë)",
    image_url: "/catalog-products/0011-rollne-shtrati-60cm-50m.webp",
    is_featured: false
  },
  {
    catalog_code: "0012",
    category_slug: "peceta-leter",
    name: "Rollne centerfeed për dispenser tualeti",
    slug: "rollne-centerfeed-300g",
    description: "Rollne centerfeed me peshë 300 g për copë. Dymbëdhjetë copë për pako.",
    price_cents: 1050,
    unit: "pako (12 copë)",
    image_url: "/catalog-products/0012-rollne-centerfeed-300g.webp",
    is_featured: false
  },
  {
    catalog_code: "0013",
    category_slug: "peceta-leter",
    name: "Rollne për tualet 2-palëshe, 140 fletë",
    slug: "rollne-tualeti-140-flete",
    description: "Rollne tualeti dy-palëshe me 140 shkëputje për copë. Njëzet e katër copë për pako.",
    price_cents: 500,
    unit: "pako (24 copë)",
    image_url: "/catalog-products/0013-rollne-tualeti-140-flete.webp",
    is_featured: false
  },
  {
    catalog_code: "0014",
    category_slug: "peceta-leter",
    name: "Rollne për duar 2-palëshe, 1 kg",
    slug: "rollne-duar-1kg",
    description: "Gjashtë rollne për pako, me peshë 1 kg për copë.",
    price_cents: 1800,
    unit: "pako (6 copë)",
    image_url: "/catalog-products/0014-rollne-duar-1kg.webp",
    is_featured: false
  },
  {
    catalog_code: "0015",
    category_slug: "kimikate-pastrimi",
    name: "Shampo për duar Ocean 5L",
    slug: "shampo-duar-ocean-5l",
    description: "Sapun i lëngshëm profesional për duar me aromë oqeani.",
    price_cents: 800,
    unit: "bidon 5L",
    image_url: "/catalog-products/0015-shampo-duar-ocean-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0016",
    category_slug: "kimikate-pastrimi",
    name: "Shampo për duar Fresh 5L",
    slug: "shampo-duar-fresh-5l",
    description: "Sapun i lëngshëm profesional për duar me aromë të freskët.",
    price_cents: 800,
    unit: "bidon 5L",
    image_url: "/catalog-products/0016-shampo-duar-fresh-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0017",
    category_slug: "kimikate-pastrimi",
    name: "Shampo për tokë me aromë sapuni 5L",
    slug: "shampo-toke-sapun-5l",
    description: "Pastrues profesional për dysheme me aromë sapuni.",
    price_cents: 1000,
    unit: "bidon 5L",
    image_url: "/catalog-products/0017-shampo-toke-sapun-5l.webp",
    is_featured: true
  },
  {
    catalog_code: "0018",
    category_slug: "kimikate-pastrimi",
    name: "Shkumë për duar Ocean 5L",
    slug: "shkume-duar-ocean-5l",
    description: "Sapun shkumë profesional për duar me aromë oqeani.",
    price_cents: 800,
    unit: "bidon 5L",
    image_url: "/catalog-products/0018-shkume-duar-ocean-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0019",
    category_slug: "kimikate-pastrimi",
    name: "Shkumë për duar Premium 5L",
    slug: "shkume-duar-premium-5l",
    description: "Sapun shkumë profesional për duar me aromë premium.",
    price_cents: 800,
    unit: "bidon 5L",
    image_url: "/catalog-products/0019-shkume-duar-premium-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0020",
    category_slug: "kimikate-pastrimi",
    name: "Shampo për tokë Bubble Gum 5L",
    slug: "shampo-toke-bubble-gum-5l",
    description: "Pastrues profesional për dysheme me aromë Bubble Gum.",
    price_cents: 1000,
    unit: "bidon 5L",
    image_url: "/catalog-products/0020-shampo-toke-bubble-gum-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0021",
    category_slug: "kimikate-pastrimi",
    name: "Dezinfektues për inventar 5L",
    slug: "dezinfektues-inventari-5l",
    description: "Dezinfektues profesional me bazë alkooli për inventar dhe sipërfaqe.",
    price_cents: 1000,
    unit: "bidon 5L",
    image_url: "/catalog-products/0021-dezinfektues-inventari-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0022",
    category_slug: "kimikate-pastrimi",
    name: "Pastrues për dru me aromë portokalli 1L",
    slug: "pastrues-dru-portokall-1l",
    description: "Pastrues për sipërfaqe druri me aromë portokalli.",
    price_cents: 350,
    unit: "shishe 1L",
    image_url: "/catalog-products/0022-pastrues-dru-portokall-1l.webp",
    is_featured: false
  },
  {
    catalog_code: "0023",
    category_slug: "kimikate-pastrimi",
    name: "Domestos dhe zbardhues 5L",
    slug: "zbardhues-5l",
    description: "Zbardhues profesional me fuqi të lartë pastruese.",
    price_cents: 750,
    unit: "bidon 5L",
    image_url: "/catalog-products/0023-zbardhues-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0024",
    category_slug: "kimikate-pastrimi",
    name: "Detergjent për enë me aromë limoni 5L",
    slug: "detergjent-enesh-limon-5l",
    description: "Detergjent profesional për larje manuale të enëve, me aromë limoni.",
    price_cents: 900,
    unit: "bidon 5L",
    image_url: "/catalog-products/0024-detergjent-enesh-limon-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0025",
    category_slug: "kimikate-pastrimi",
    name: "Heqës njollash për tekstile 750ml",
    slug: "heqes-njollash-750ml",
    description: "Sprej për heqjen e njollave nga bezet dhe veshjet.",
    price_cents: 180,
    unit: "shishe 750ml",
    image_url: "/catalog-products/0025-heqes-njollash-750ml.webp",
    is_featured: false
  },
  {
    catalog_code: "0026",
    category_slug: "kimikate-pastrimi",
    name: "Politur për inox 750ml",
    slug: "politur-inox-750ml",
    description: "Politur profesional për pastrim dhe shkëlqim të sipërfaqeve inox.",
    price_cents: 300,
    unit: "shishe 750ml",
    image_url: "/catalog-products/0026-politur-inox-750ml.webp",
    is_featured: false
  },
  {
    catalog_code: "0027",
    category_slug: "kimikate-pastrimi",
    name: "Krem i lëngshëm ARF 1L",
    slug: "krem-pastrues-arf-1l",
    description: "Krem i lëngshëm pastrues për sipërfaqe të forta.",
    price_cents: 180,
    unit: "shishe 1L",
    image_url: "/catalog-products/0027-krem-pastrues-arf-1l.webp",
    is_featured: false
  },
  {
    catalog_code: "0028",
    category_slug: "kimikate-pastrimi",
    name: "Domestos 1L",
    slug: "domestos-1l",
    description: "Pastrues dhe zbardhues i koncentruar për përdorim profesional.",
    price_cents: 190,
    unit: "shishe 1L",
    image_url: "/catalog-products/0028-domestos-1l.webp",
    is_featured: false
  },
  {
    catalog_code: "0029",
    category_slug: "kimikate-pastrimi",
    name: "Detergjent për enë me aromë molle 5L",
    slug: "detergjent-enesh-molle-5l",
    description: "Detergjent profesional për larje manuale të enëve, me aromë molle.",
    price_cents: 900,
    unit: "bidon 5L",
    image_url: "/catalog-products/0029-detergjent-enesh-molle-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0030",
    category_slug: "kimikate-pastrimi",
    name: "Shampo për dysheme me makineri 5L",
    slug: "shampo-dyshemeje-makineri-5l",
    description: "Detergjent profesional për larjen e dyshemeve me makineri.",
    price_cents: 1200,
    unit: "bidon 5L",
    image_url: "/catalog-products/0030-shampo-dyshemeje-makineri-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0031",
    category_slug: "kimikate-pastrimi",
    name: "Detergjent për enëlarëse 20L",
    slug: "detergjent-enelarese-20l",
    description: "Detergjent i lëngshëm profesional për makina enëlarëse.",
    price_cents: 4500,
    unit: "bidon 20L",
    image_url: "/catalog-products/0031-detergjent-enelarese-20l.webp",
    is_featured: false
  },
  {
    catalog_code: "0032",
    category_slug: "kimikate-pastrimi",
    name: "Shkëlqyes për enëlarëse 20L",
    slug: "shkelqyes-enelarese-20l",
    description: "Shkëlqyes profesional për makina enëlarëse.",
    price_cents: 5000,
    unit: "bidon 20L",
    image_url: "/catalog-products/0032-shkelqyes-enelarese-20l.webp",
    is_featured: false
  },
  {
    catalog_code: "0033",
    category_slug: "lavanderi",
    name: "Detergjent pluhur për rroba 1.5 kg",
    slug: "detergjent-rrobash-1-5kg",
    description: "Detergjent pluhur për larjen e rrobave të bardha dhe me ngjyra.",
    price_cents: 250,
    unit: "pako 1.5 kg",
    image_url: "/catalog-products/0033-detergjent-rrobash-1-5kg.webp",
    is_featured: false
  },
  {
    catalog_code: "0034",
    category_slug: "lavanderi",
    name: "Detergjent pluhur për rroba 3 kg",
    slug: "detergjent-rrobash-3kg",
    description: "Detergjent pluhur për larjen e rrobave të bardha dhe me ngjyra.",
    price_cents: 450,
    unit: "pako 3 kg",
    image_url: "/catalog-products/0034-detergjent-rrobash-3kg.webp",
    is_featured: false
  },
  {
    catalog_code: "0035",
    category_slug: "kimikate-pastrimi",
    name: "Degresant për yndyrë 5L",
    slug: "degresant-5l",
    description: "Pastrues profesional për heqjen e yndyrës së rëndë.",
    price_cents: 1000,
    unit: "bidon 5L",
    image_url: "/catalog-products/0035-degresant-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0036",
    category_slug: "kimikate-pastrimi",
    name: "Pastrues kundër gëlqeres me aromë 5L",
    slug: "pastrues-gelqereje-5l",
    description: "Pastrues profesional aromatik kundër gëlqeres dhe depozitave minerale.",
    price_cents: 1100,
    unit: "bidon 5L",
    image_url: "/catalog-products/0036-pastrues-gelqereje-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0037",
    category_slug: "kimikate-pastrimi",
    name: "Sprej për xhama Pro Glass 750ml",
    slug: "sprej-xhami-750ml",
    description: "Sprej profesional për pastrim pa vija të xhamave dhe pasqyrave.",
    price_cents: 120,
    unit: "shishe 750ml",
    image_url: "/catalog-products/0037-sprej-xhami-750ml.webp",
    is_featured: false
  },
  {
    catalog_code: "0038",
    category_slug: "kimikate-pastrimi",
    name: "Pastrues për xhama Pro Glass 5L",
    slug: "pastrues-xhami-5l",
    description: "Pastrues profesional për xhama dhe pasqyra në format ekonomik.",
    price_cents: 700,
    unit: "bidon 5L",
    image_url: "/catalog-products/0038-pastrues-xhami-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0039",
    category_slug: "hotelieri",
    name: "Shampo për flokë Heavenly 5L",
    slug: "shampo-flokesh-heavenly-5l",
    description: "Shampo profesionale për flokë në format ekonomik për hotelieri.",
    price_cents: 1200,
    unit: "bidon 5L",
    image_url: "/catalog-products/0039-shampo-flokesh-reposak-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0040",
    category_slug: "hotelieri",
    name: "Shampo për trup 5L",
    slug: "shampo-trupi-5l",
    description: "Shampo profesionale për trup në format ekonomik për hotelieri.",
    price_cents: 1200,
    unit: "bidon 5L",
    image_url: "/catalog-products/0040-shampo-trupi-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0041",
    category_slug: "hotelieri",
    name: "Shampo për flokë Celestia 5L",
    slug: "shampo-flokesh-celestia-5l",
    description: "Shampo profesionale Celestia në format ekonomik për hotelieri.",
    price_cents: 1200,
    unit: "bidon 5L",
    image_url: "/catalog-products/0041-shampo-flokesh-celestia-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0042",
    category_slug: "aroma-aparate",
    name: "Aromë ambienti sprej 550ml",
    slug: "arome-ambienti-sprej-550ml",
    description: "Sprej aromatik për freskimin e ambienteve profesionale.",
    price_cents: 300,
    unit: "shishe 550ml",
    image_url: "/catalog-products/0042-arome-ambienti-sprej-550ml.webp",
    is_featured: false
  },
  {
    catalog_code: "0043",
    category_slug: "kimikate-pastrimi",
    name: "Dezinfektues për duar 76% alkool 1L",
    slug: "dezinfektues-duar-1l",
    description: "Dezinfektues profesional për duar me 76% alkool dhe pompë dozimi.",
    price_cents: 250,
    unit: "shishe 1L",
    image_url: "/catalog-products/0043-dezinfektues-duar-1l.webp",
    is_featured: false
  },
  {
    catalog_code: "0044",
    category_slug: "kimikate-pastrimi",
    name: "Dezinfektues për duar 76% alkool 5L",
    slug: "dezinfektues-duar-5l",
    description: "Dezinfektues profesional për duar me 76% alkool në format ekonomik.",
    price_cents: 1200,
    unit: "bidon 5L",
    image_url: "/catalog-products/0044-dezinfektues-duar-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0045",
    category_slug: "shporta-mbeturinash",
    name: "Shportë mbeturinash e hapur 6L",
    slug: "shporte-hapur-6l",
    description: "Shportë e hapur me kapacitet 6 litra për ambiente të brendshme.",
    price_cents: 1500,
    unit: "copë",
    image_url: "/catalog-products/0045-shporte-hapur-6l.webp",
    is_featured: false
  },
  {
    catalog_code: "0046",
    category_slug: "shporta-mbeturinash",
    name: "Shportë mbeturinash e hapur 25L",
    slug: "shporte-hapur-25l",
    description: "Shportë e hapur me kapacitet 25 litra, në variant të bardhë ose të zi.",
    price_cents: 3000,
    unit: "copë",
    image_url: "/catalog-products/0046-shporte-hapur-25l.webp",
    is_featured: false
  },
  {
    catalog_code: "0047",
    category_slug: "shporta-mbeturinash",
    name: "Shportë mbeturinash e hapur 50L",
    slug: "shporte-hapur-50l",
    description: "Shportë e hapur me kapacitet 50 litra për ambiente me qarkullim të lartë.",
    price_cents: 4500,
    unit: "copë",
    image_url: "/catalog-products/0047-shporte-hapur-50l.webp",
    is_featured: false
  },
  {
    catalog_code: "0048",
    category_slug: "shporta-mbeturinash",
    name: "Shportë mbeturinash 15L",
    slug: "shporte-mbeturinash-15l",
    description: "Shportë mbeturinash me kapak lëkundës dhe kapacitet 15 litra.",
    price_cents: 1500,
    unit: "copë",
    image_url: "/catalog-products/0048-shporte-mbeturinash-15l.webp",
    is_featured: false
  },
  {
    catalog_code: "0049",
    category_slug: "shporta-mbeturinash",
    name: "Shportë në formë basketi 15L",
    slug: "shporte-basketi-15l",
    description: "Shportë në formë basketi me kapacitet 15 litra.",
    price_cents: 1500,
    unit: "copë",
    image_url: "/catalog-products/0049-shporte-basketi-15l.webp",
    is_featured: false
  },
  {
    catalog_code: "0050",
    category_slug: "shporta-mbeturinash",
    name: "Shportë mbeturinash inox 5L",
    slug: "shporte-inox-5l",
    description: "Shportë inox me pedal dhe kapacitet 5 litra.",
    price_cents: 1600,
    unit: "copë",
    image_url: "/catalog-products/0050-shporte-inox-5l.webp",
    is_featured: false
  },
  {
    catalog_code: "0051",
    category_slug: "aroma-aparate",
    name: "Hygiene Fresh - aromë ambienti 250ml",
    slug: "hygiene-fresh-250ml",
    description: "Aromë ekskluzive nga Dubai për shtëpi, zyra dhe biznese. Kohëzgjatje deri në 21 ditë.",
    price_cents: 750,
    unit: "rimbushje 250ml",
    image_url: "/catalog-products/0051-hygiene-fresh-250ml.webp",
    is_featured: true
  },
  {
    catalog_code: "0052",
    category_slug: "kontroll-insektesh",
    name: "Hygiene Zone - sprej kundër insekteve",
    slug: "hygiene-zone-insekte",
    description: "Sprej italian kundër mushkonjave, mizave dhe insekteve të tjera. Vepron deri në 30 ditë.",
    price_cents: 1400,
    unit: "sprej",
    image_url: "/catalog-products/0052-hygiene-zone-insekte.webp",
    is_featured: false
  }
];

export class Catalog20251787356803000 implements MigrationInterface {
  name = "Catalog20251787356803000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD "catalog_code" text`);
    await queryRunner.query(`
      ALTER TABLE "products"
      ADD CONSTRAINT "ck_products_catalog_code"
      CHECK ("catalog_code" IS NULL OR "catalog_code" ~ '^[0-9]{4}$')
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_products_catalog_code"
      ON "products" ("catalog_code")
    `);

    await queryRunner.query(`
      INSERT INTO "categories" ("id", "name", "slug", "description", "sort_order") VALUES
        ('11111111-1111-4111-8111-555555555555', 'Lavanderi', 'lavanderi', 'Detergjentë profesionalë për larjen dhe mirëmbajtjen e tekstileve.', 3),
        ('11111111-1111-4111-8111-666666666666', 'Shporta mbeturinash', 'shporta-mbeturinash', 'Shporta funksionale për zyra, hotelieri dhe ambiente publike.', 6),
        ('11111111-1111-4111-8111-777777777777', 'Kontroll insektesh', 'kontroll-insektesh', 'Produkte profesionale kundër insekteve për ambiente të brendshme.', 7)
      ON CONFLICT ("slug") DO UPDATE SET
        "name" = EXCLUDED."name",
        "description" = EXCLUDED."description",
        "sort_order" = EXCLUDED."sort_order",
        "is_active" = true,
        "updated_at" = now()
    `);

    await queryRunner.query(`
      UPDATE "categories" SET "sort_order" = CASE "slug"
        WHEN 'peceta-leter' THEN 1
        WHEN 'kimikate-pastrimi' THEN 2
        WHEN 'lavanderi' THEN 3
        WHEN 'hotelieri' THEN 4
        WHEN 'aroma-aparate' THEN 5
        WHEN 'shporta-mbeturinash' THEN 6
        WHEN 'kontroll-insektesh' THEN 7
        ELSE "sort_order"
      END,
      "updated_at" = now()
    `);

    await queryRunner.query(`
      UPDATE "products"
      SET "is_active" = false, "is_featured" = false, "updated_at" = now()
      WHERE "catalog_code" IS NULL
    `);

    await queryRunner.query(`
      INSERT INTO "products" (
        "catalog_code", "category_id", "name", "slug", "description",
        "price_cents", "currency", "unit", "image_urls", "image_keys",
        "is_active", "is_featured", "requires_quote", "stock_label"
      )
      SELECT
        item.catalog_code,
        category.id,
        item.name,
        item.slug,
        item.description,
        item.price_cents,
        'EUR',
        item.unit,
        ARRAY[item.image_url],
        '{}',
        true,
        item.is_featured,
        false,
        'Në stok'
      FROM jsonb_to_recordset($1::jsonb) AS item(
        catalog_code text,
        category_slug text,
        name text,
        slug text,
        description text,
        price_cents integer,
        unit text,
        image_url text,
        is_featured boolean
      )
      INNER JOIN "categories" category ON category."slug" = item.category_slug
      ON CONFLICT ("catalog_code") DO UPDATE SET
        "category_id" = EXCLUDED."category_id",
        "name" = EXCLUDED."name",
        "slug" = EXCLUDED."slug",
        "description" = EXCLUDED."description",
        "price_cents" = EXCLUDED."price_cents",
        "currency" = EXCLUDED."currency",
        "unit" = EXCLUDED."unit",
        "image_urls" = EXCLUDED."image_urls",
        "image_keys" = EXCLUDED."image_keys",
        "is_active" = EXCLUDED."is_active",
        "is_featured" = EXCLUDED."is_featured",
        "requires_quote" = EXCLUDED."requires_quote",
        "stock_label" = EXCLUDED."stock_label",
        "updated_at" = now()
    `, [JSON.stringify(catalogProducts)]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "products"
      WHERE "catalog_code" BETWEEN '0001' AND '0052'
    `);
    await queryRunner.query(`
      UPDATE "products" SET
        "is_active" = true,
        "is_featured" = "id" IN (
          '21111111-1111-4111-8111-111111111111',
          '21111111-1111-4111-8111-222222222222',
          '21111111-1111-4111-8111-444444444444'
        ),
        "updated_at" = now()
      WHERE "id"::text LIKE '21111111-1111-4111-8111-%'
    `);
    await queryRunner.query(`
      DELETE FROM "categories"
      WHERE "slug" IN ('lavanderi', 'shporta-mbeturinash', 'kontroll-insektesh')
    `);
    await queryRunner.query(`DROP INDEX "uq_products_catalog_code"`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "ck_products_catalog_code"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "catalog_code"`);
  }
}
