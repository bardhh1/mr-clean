import { zodResolver } from "@hookform/resolvers/zod";
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  LogOut,
  PackagePlus,
  ShieldAlert,
  Tags
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  getSessionUser,
  signInAdmin,
  signOutAdmin,
  updateProductStatus,
  uploadProductImage,
  upsertCategory,
  upsertProduct
} from "@/lib/admin";
import { getAdminProducts, getCategories } from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import { getOrders, getQuotes } from "@/lib/orders";
import { hasSupabaseConfig } from "@/lib/supabase";
import type { Category, OrderRecord, Product, QuoteRecord } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Select } from "@/components/ui/select";

const loginSchema = z.object({
  email: z.string().email("Email nuk është valid."),
  password: z.string().min(6, "Fjalëkalimi duhet të ketë së paku 6 karaktere.")
});

const categorySchema = z.object({
  name: z.string().min(2, "Shkruani emrin e kategorisë."),
  description: z.string().optional(),
  sort_order: z.coerce.number().default(99)
});

const productSchema = z.object({
  name: z.string().min(2, "Shkruani emrin e produktit."),
  category_id: z.string().min(1, "Zgjedhni kategorinë."),
  description: z.string().min(8, "Shtoni përshkrim më të qartë."),
  price_cents: z.coerce.number().min(0, "Çmimi nuk mund të jetë negativ."),
  unit: z.string().min(2, "Shkruani njësinë."),
  stock_label: z.string().min(2, "Shkruani statusin."),
  image_url: z.string().url("Vendos URL valide ose ngarko imazh.").optional().or(z.literal("")),
  is_featured: z.coerce.boolean().default(false),
  requires_quote: z.coerce.boolean().default(false),
  image_file: z.any().optional()
});

type LoginValues = z.infer<typeof loginSchema>;
type CategoryInput = z.input<typeof categorySchema>;
type CategoryValues = z.output<typeof categorySchema>;
type ProductInput = z.input<typeof productSchema>;
type ProductValues = z.output<typeof productSchema>;

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const categoryForm = useForm<CategoryInput, unknown, CategoryValues>({
    resolver: zodResolver(categorySchema)
  });
  const productForm = useForm<ProductInput, unknown, ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      price_cents: 0,
      stock_label: "Në stok",
      unit: "copë",
      is_featured: false,
      requires_quote: false
    }
  });

  const summary = useMemo(
    () => [
      { label: "Produkte", value: products.length, icon: Boxes },
      { label: "Kategori", value: categories.length, icon: Tags },
      { label: "Porosi", value: orders.length, icon: ClipboardList },
      { label: "Oferta", value: quotes.length, icon: PackagePlus }
    ],
    [categories.length, orders.length, products.length, quotes.length]
  );

  async function refresh() {
    const [nextCategories, nextProducts, nextOrders, nextQuotes] = await Promise.all([
      getCategories(),
      getAdminProducts(),
      getOrders(),
      getQuotes()
    ]);
    setCategories(nextCategories);
    setProducts(nextProducts);
    setOrders(nextOrders);
    setQuotes(nextQuotes);
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const user = await getSessionUser();
        if (!cancelled) setAuthenticated(Boolean(user));
        if (user) await refresh();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Admin nuk u ngarkua.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onLogin(values: LoginValues) {
    setError(null);
    try {
      await signInAdmin(values.email, values.password);
      setAuthenticated(true);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kyçja dështoi.");
    }
  }

  async function onCategorySubmit(values: CategoryValues) {
    setNotice(null);
    setError(null);
    try {
      await upsertCategory(values);
      categoryForm.reset();
      await refresh();
      setNotice("Kategoria u ruajt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kategoria nuk u ruajt.");
    }
  }

  async function onProductSubmit(values: ProductValues) {
    setNotice(null);
    setError(null);
    try {
      const file = values.image_file?.item?.(0) as File | undefined;
      const imageUrl = file ? await uploadProductImage(file) : values.image_url;
      await upsertProduct({
        name: values.name,
        category_id: values.category_id,
        description: values.description,
        price_cents: values.price_cents,
        unit: values.unit,
        stock_label: values.stock_label,
        image_urls: imageUrl ? [imageUrl] : [],
        is_featured: values.is_featured,
        requires_quote: values.requires_quote,
        is_active: true
      });
      productForm.reset({
        price_cents: 0,
        stock_label: "Në stok",
        unit: "copë",
        is_featured: false,
        requires_quote: false
      });
      await refresh();
      setNotice("Produkti u ruajt.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Produkti nuk u ruajt.");
    }
  }

  async function toggleProduct(product: Product) {
    setError(null);
    try {
      await updateProductStatus(product.id, { is_active: !product.is_active });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Statusi nuk u ndryshua.");
    }
  }

  async function logout() {
    await signOutAdmin();
    setAuthenticated(false);
  }

  if (!hasSupabaseConfig) {
    return (
      <section className="container py-10">
        <EmptyState
          icon={ShieldAlert}
          title="Admin kërkon Supabase"
          description="Vendos VITE_SUPABASE_URL dhe VITE_SUPABASE_ANON_KEY në .env për të aktivizuar panelin."
        />
      </section>
    );
  }

  if (loading) {
    return <section className="container py-10"><div className="surface h-96 animate-pulse bg-muted" /></section>;
  }

  if (!authenticated) {
    return (
      <section className="container flex min-h-[calc(100dvh-8rem)] items-center justify-center py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Kyçu në admin</CardTitle>
            <CardDescription>Menaxho produktet, kategoritë dhe kërkesat e klientëve.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={loginForm.handleSubmit(onLogin)}>
              <Field label="Email" error={loginForm.formState.errors.email?.message}>
                <Input type="email" autoComplete="email" {...loginForm.register("email")} />
              </Field>
              <Field label="Fjalëkalimi" error={loginForm.formState.errors.password?.message}>
                <Input type="password" autoComplete="current-password" {...loginForm.register("password")} />
              </Field>
              {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
              <Button type="submit">Kyçu</Button>
            </form>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="container py-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold text-primary">Paneli Mr. Clean</p>
          <h1 className="mt-2 text-3xl font-bold">Admin dashboard</h1>
        </div>
        <Button variant="outline" onClick={logout}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Dil
        </Button>
      </div>

      {notice ? (
        <div className="mt-6 flex items-center gap-2 rounded-md border border-accent bg-accent/10 p-3 text-sm font-medium text-accent">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {notice}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="mt-6 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mt-7 grid gap-4 md:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-3 text-3xl font-bold">{item.value}</p>
              <p className="text-sm text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[380px_1fr]">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Kategori e re</CardTitle>
              <CardDescription>Shto kategori për filtrat e katalogut.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={categoryForm.handleSubmit(onCategorySubmit)}>
                <Field label="Emri" error={categoryForm.formState.errors.name?.message}>
                  <Input {...categoryForm.register("name")} />
                </Field>
                <Field label="Përshkrimi" error={categoryForm.formState.errors.description?.message}>
                  <Textarea {...categoryForm.register("description")} />
                </Field>
                <Field label="Renditja" error={categoryForm.formState.errors.sort_order?.message}>
                  <Input type="number" {...categoryForm.register("sort_order")} />
                </Field>
                <Button type="submit">Ruaj kategorinë</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Produkt i ri</CardTitle>
              <CardDescription>Çmimi ruhet në centë, p.sh. 8.90 EUR = 890.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={productForm.handleSubmit(onProductSubmit)}>
                <Field label="Emri" error={productForm.formState.errors.name?.message}>
                  <Input {...productForm.register("name")} />
                </Field>
                <Field label="Kategoria" error={productForm.formState.errors.category_id?.message}>
                  <Select {...productForm.register("category_id")}>
                    <option value="">Zgjedh kategorinë</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Përshkrimi" error={productForm.formState.errors.description?.message}>
                  <Textarea {...productForm.register("description")} />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Çmimi në centë" error={productForm.formState.errors.price_cents?.message}>
                    <Input type="number" min={0} {...productForm.register("price_cents")} />
                  </Field>
                  <Field label="Njësia" error={productForm.formState.errors.unit?.message}>
                    <Input {...productForm.register("unit")} />
                  </Field>
                </div>
                <Field label="Statusi" error={productForm.formState.errors.stock_label?.message}>
                  <Input {...productForm.register("stock_label")} />
                </Field>
                <Field label="URL e imazhit" error={productForm.formState.errors.image_url?.message}>
                  <Input type="url" {...productForm.register("image_url")} />
                </Field>
                <Field label="Ngarko imazh" error={String(productForm.formState.errors.image_file?.message ?? "")}>
                  <Input type="file" accept="image/*" {...productForm.register("image_file")} />
                </Field>
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input type="checkbox" className="h-5 w-5" {...productForm.register("is_featured")} />
                  Produkt i zgjedhur
                </label>
                <label className="flex items-center gap-3 text-sm font-medium">
                  <input type="checkbox" className="h-5 w-5" {...productForm.register("requires_quote")} />
                  Kërkon ofertë
                </label>
                <Button type="submit">Ruaj produktin</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Produktet</CardTitle>
              <CardDescription>Aktivizo ose fshih produktet nga katalogu publik.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b text-muted-foreground">
                    <tr>
                      <th className="py-3 pr-4 font-medium">Produkti</th>
                      <th className="py-3 pr-4 font-medium">Çmimi</th>
                      <th className="py-3 pr-4 font-medium">Statusi</th>
                      <th className="py-3 pr-4 font-medium">Tipi</th>
                      <th className="py-3 pr-4 font-medium">Veprim</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td className="py-3 pr-4 font-medium">{product.name}</td>
                        <td className="py-3 pr-4">
                          {product.requires_quote ? "Me ofertë" : formatCurrency(product.price_cents)}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant={product.is_active ? "secondary" : "outline"}>
                            {product.is_active ? "Aktiv" : "Fshehur"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          {product.requires_quote ? "Ofertë" : product.is_featured ? "Featured" : "Standard"}
                        </td>
                        <td className="py-3 pr-4">
                          <Button size="sm" variant="outline" onClick={() => toggleProduct(product)}>
                            {product.is_active ? "Fshih" : "Aktivizo"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <LeadTable title="Porositë" empty="Ende nuk ka porosi." rows={orders.map((order) => ({
              id: order.id,
              title: order.customer_name,
              meta: `${order.company_name || "Pa biznes"} · ${formatCurrency(order.total_cents)}`,
              status: order.status
            }))} />
            <LeadTable title="Kërkesat për oferta" empty="Ende nuk ka kërkesa." rows={quotes.map((quote) => ({
              id: quote.id,
              title: quote.customer_name,
              meta: `${quote.company_name || "Pa biznes"} · ${quote.quantity} copë`,
              status: quote.status
            }))} />
          </div>
        </div>
      </div>
    </section>
  );
}

function LeadTable({
  title,
  empty,
  rows
}: {
  title: string;
  empty: string;
  rows: Array<{ id: string; title: string; meta: string; status: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="grid gap-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-md border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{row.meta}</p>
                  </div>
                  <Badge variant="outline">{row.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
