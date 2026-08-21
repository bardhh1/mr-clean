import type { Category, Product } from "@/lib/types";

export const demoCategories: Category[] = [
  {
    id: "cat-napkins",
    name: "Peceta dhe letër",
    slug: "peceta-leter",
    description: "Peceta tavoline, letër kuzhine dhe letër higjienike për përdorim profesional.",
    sort_order: 1,
    is_active: true
  },
  {
    id: "cat-chemicals",
    name: "Kimikate pastrimi",
    slug: "kimikate-pastrimi",
    description: "Detergjentë, dezinfektues dhe produkte për sipërfaqe profesionale.",
    sort_order: 2,
    is_active: true
  },
  {
    id: "cat-aroma",
    name: "Aroma dhe aparate",
    slug: "aroma-aparate",
    description: "Spray, aroma ambienti dhe aparate me avull për hapësira biznesi.",
    sort_order: 3,
    is_active: true
  },
  {
    id: "cat-hotel",
    name: "Hotelieri",
    slug: "hotelieri",
    description: "Shampo, sapunë, pajisje dhome dhe produkte të vogla për hotele.",
    sort_order: 4,
    is_active: true
  }
];

export const demoProducts: Product[] = [
  {
    id: "prod-napkin-white",
    category_id: "cat-napkins",
    name: "Peceta të bardha 33x33",
    slug: "peceta-te-bardha-33x33",
    description: "Pako profesionale për restorante, kafiteri dhe evente me përdorim të shpeshtë.",
    price_cents: 240,
    currency: "EUR",
    unit: "pako",
    image_urls: [
      "/products/napkins-pack.png"
    ],
    is_active: true,
    is_featured: true,
    requires_quote: false,
    stock_label: "Në stok"
  },
  {
    id: "prod-floor-cleaner",
    category_id: "cat-chemicals",
    name: "Detergjent dyshemeje 5L",
    slug: "detergjent-dyshemeje-5l",
    description: "Formulë për pastrim ditor të dyshemeve në ambiente biznesi dhe kuzhina.",
    price_cents: 890,
    currency: "EUR",
    unit: "bidon 5L",
    image_urls: [
      "/products/floor-cleaner-5l.png"
    ],
    is_active: true,
    is_featured: true,
    requires_quote: false,
    stock_label: "Në stok"
  },
  {
    id: "prod-disinfectant",
    category_id: "cat-chemicals",
    name: "Dezinfektues sipërfaqesh 1L",
    slug: "dezinfektues-siperfaqesh-1l",
    description: "Për tavolina, banakë, kuzhina dhe hapësira ku higjiena duhet të jetë konstante.",
    price_cents: 450,
    currency: "EUR",
    unit: "shishe",
    image_urls: [
      "/products/disinfectant-1l.png"
    ],
    is_active: true,
    is_featured: false,
    requires_quote: false,
    stock_label: "Në stok"
  },
  {
    id: "prod-aroma-machine",
    category_id: "cat-aroma",
    name: "Aparat arome me avull",
    slug: "aparat-arome-me-avull",
    description: "Aparat për aromatizim ambienti në recepsione, zyra, lokale dhe hotele.",
    price_cents: 3990,
    currency: "EUR",
    unit: "copë",
    image_urls: [
      "/products/aroma-machine.png"
    ],
    is_active: true,
    is_featured: true,
    requires_quote: false,
    stock_label: "Në stok"
  },
  {
    id: "prod-aroma-refill",
    category_id: "cat-aroma",
    name: "Aromë ambienti 250ml",
    slug: "arome-ambienti-250ml",
    description: "Rimbushje për aparat arome, e përshtatshme për ambiente me qarkullim të lartë.",
    price_cents: 630,
    currency: "EUR",
    unit: "shishe",
    image_urls: [
      "/products/aroma-bottle-250ml.png"
    ],
    is_active: true,
    is_featured: false,
    requires_quote: false,
    stock_label: "Në stok"
  },
  {
    id: "prod-hotel-shampoo",
    category_id: "cat-hotel",
    name: "Shampo hoteli 30ml",
    slug: "shampo-hoteli-30ml",
    description: "Format ekonomik për dhoma hoteli, bujtina dhe apartamente me qira.",
    price_cents: 55,
    currency: "EUR",
    unit: "copë",
    image_urls: [
      "/products/hotel-shampoo-30ml.png"
    ],
    is_active: true,
    is_featured: false,
    requires_quote: false,
    stock_label: "Porosi shumice"
  }
];
