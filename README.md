# Mr. Clean

Vite + React + TypeScript e-commerce site for Mr. Clean, a Kosovo business selling sanitary supplies, custom napkins, cleaning chemicals, aromas, air purifiers and hotel/restaurant supplies.

## Features

- Albanian-first public storefront with EUR pricing.
- Product catalog, category filters, search, detail pages and localStorage cart.
- Checkout that saves an order in Supabase and opens WhatsApp with a prefilled message.
- Quote request flow for personalized napkins with optional logo/reference upload.
- Supabase Auth admin panel for products, categories, images, orders and quote leads.
- Demo catalog fallback, so the site runs before Supabase credentials are added.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set these variables in `.env` when Supabase is ready:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_WHATSAPP_PHONE=38344123456
VITE_SITE_URL=http://localhost:5173
```

## Supabase

Run `supabase/schema.sql` in the Supabase SQL editor. It creates:

- `categories`
- `products`
- `orders`
- `order_items`
- `quote_requests`
- `product-images` and `quote-uploads` storage buckets
- RLS policies
- `create_order_from_cart` RPC for server-side price recalculation

Create an admin user in Supabase Auth, then use `/admin` to manage the catalog.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
