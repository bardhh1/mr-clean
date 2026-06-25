import type { Category, Product } from "@/lib/types";

export const demoCategories: Category[] = [
  {
    id: "cat-napkins",
    name: "Peceta dhe letër",
    slug: "peceta-leter",
    description: "Peceta tavoline, letër kuzhine, letër higjienike dhe opsione të personalizuara.",
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
    id: "prod-custom-napkins",
    category_id: "cat-napkins",
    name: "Peceta të personalizuara",
    slug: "peceta-te-personalizuara",
    description:
      "Peceta për restorante dhe kafiteri me logo, tekst ose dizajn sipas kërkesës së klientit.",
    price_cents: 0,
    currency: "EUR",
    unit: "me ofertë",
    image_urls: [
      "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=1200&q=80"
    ],
    is_active: true,
    is_featured: true,
    requires_quote: true,
    stock_label: "Me porosi"
  },
  {
    id: "prod-napkin-white",
    category_id: "cat-napkins",
    name: "Peceta të bardha 33x33",
    slug: "peceta-te-bardha-33x33",
    description: "Pako profesionale për restorante, kafiteri dhe evente me përdorim të shpeshtë.",
    price_cents: 420,
    currency: "EUR",
    unit: "pako",
    image_urls: [
      "https://images.unsplash.com/photo-1603204077779-bed963ea7d0e?auto=format&fit=crop&w=1200&q=80"
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
      "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=1200&q=80"
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
    price_cents: 360,
    currency: "EUR",
    unit: "shishe",
    image_urls: [
      "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=1200&q=80"
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
    price_cents: 3490,
    currency: "EUR",
    unit: "copë",
    image_urls: [
      "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=1200&q=80"
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
    price_cents: 690,
    currency: "EUR",
    unit: "shishe",
    image_urls: [
      "https://images.unsplash.com/photo-1602928321679-560bb453f190?auto=format&fit=crop&w=1200&q=80"
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
    price_cents: 24,
    currency: "EUR",
    unit: "copë",
    image_urls: [
      "https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1200&q=80"
    ],
    is_active: true,
    is_featured: false,
    requires_quote: false,
    stock_label: "Porosi shumice"
  }
];
