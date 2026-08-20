create extension if not exists "pgcrypto";

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  sort_order integer not null default 99,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text not null,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'EUR',
  unit text not null,
  image_urls text[] not null default '{}',
  is_active boolean not null default true,
  is_featured boolean not null default false,
  requires_quote boolean not null default false,
  stock_label text not null default 'Në stok',
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  company_name text,
  phone text not null,
  city text not null,
  address text not null,
  notes text,
  payment_preference text not null check (payment_preference in ('cash', 'bank_transfer')),
  total_cents integer not null default 0 check (total_cents >= 0),
  currency text not null default 'EUR',
  status text not null default 'pending_whatsapp',
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Public active categories" on public.categories;
create policy "Public active categories"
  on public.categories for select
  using (is_active = true or auth.role() = 'authenticated');

drop policy if exists "Public active products" on public.products;
create policy "Public active products"
  on public.products for select
  using (is_active = true or auth.role() = 'authenticated');

drop policy if exists "Authenticated category writes" on public.categories;
create policy "Authenticated category writes"
  on public.categories for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated product writes" on public.products;
create policy "Authenticated product writes"
  on public.products for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop policy if exists "Public order inserts" on public.orders;
create policy "Public order inserts"
  on public.orders for insert
  with check (true);

drop policy if exists "Authenticated order reads" on public.orders;
create policy "Authenticated order reads"
  on public.orders for select
  using (auth.role() = 'authenticated');

drop policy if exists "Public order item inserts" on public.order_items;
create policy "Public order item inserts"
  on public.order_items for insert
  with check (true);

drop policy if exists "Authenticated order item reads" on public.order_items;
create policy "Authenticated order item reads"
  on public.order_items for select
  using (auth.role() = 'authenticated');

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public product image reads" on storage.objects;
create policy "Public product image reads"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "Authenticated product image writes" on storage.objects;
create policy "Authenticated product image writes"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

create or replace function public.create_order_from_cart(
  "order" jsonb,
  items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  created_order public.orders;
  item jsonb;
  product_row public.products;
  line_total integer;
  computed_total integer := 0;
begin
  if jsonb_array_length(items) = 0 then
    raise exception 'Cart is empty';
  end if;

  insert into public.orders (
    customer_name,
    company_name,
    phone,
    city,
    address,
    notes,
    payment_preference,
    total_cents,
    currency,
    status
  )
  values (
    "order"->>'customer_name',
    nullif("order"->>'company_name', ''),
    "order"->>'phone',
    "order"->>'city',
    "order"->>'address',
    nullif("order"->>'notes', ''),
    "order"->>'payment_preference',
    0,
    'EUR',
    'pending_whatsapp'
  )
  returning * into created_order;

  for item in select * from jsonb_array_elements(items)
  loop
    select *
    into product_row
    from public.products
    where id = (item->>'product_id')::uuid
      and is_active = true
      and requires_quote = false;

    if product_row.id is null then
      raise exception 'Invalid product in cart';
    end if;

    line_total := product_row.price_cents * ((item->>'quantity')::integer);
    computed_total := computed_total + line_total;

    insert into public.order_items (
      order_id,
      product_id,
      name_snapshot,
      quantity,
      unit_price_cents,
      line_total_cents
    )
    values (
      created_order.id,
      product_row.id,
      product_row.name,
      (item->>'quantity')::integer,
      product_row.price_cents,
      line_total
    );
  end loop;

  update public.orders
  set total_cents = computed_total
  where id = created_order.id
  returning * into created_order;

  return created_order;
end;
$$;
