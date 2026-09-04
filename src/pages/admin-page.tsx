import { zodResolver } from "@hookform/resolvers/zod";
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  KeyRound,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Tags
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  getSessionUser,
  signInAdmin,
  signOutAdmin,
  verifyAdminMfa,
  updateProductStatus,
  uploadProductImage,
  upsertCategory,
  upsertProduct
} from "@/lib/admin";
import type { MfaChallenge } from "@/lib/admin";
import { getAdminCategories, getAdminProducts } from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import { getOrders, updateOrderStatus } from "@/lib/orders";
import { hasApiConfig } from "@/lib/api";
import type { Category, OrderRecord, Product } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Select } from "@/components/ui/select";

const loginSchema = z.object({
  email: z.string().email("Email nuk është valid."),
  password: z.string().min(12, "Fjalëkalimi duhet të ketë së paku 12 karaktere.")
});

const mfaSchema = z.object({
  code: z.string()
    .trim()
    .regex(
      /^(?:\d{6}|[A-Za-z2-7]{4}(?:-[A-Za-z2-7]{4}){3})$/,
      "Shkruani kodin 6-shifror ose një kod rikuperimi."
    )
});

const categorySchema = z.object({
  name: z.string().min(2, "Shkruani emrin e kategorisë."),
  description: z.string().optional(),
  sort_order: z.coerce.number().default(99)
});

const productSchema = z.object({
  catalog_code: z.string().regex(/^\d{4}$/, "Kodi duhet të ketë 4 shifra.").optional().or(z.literal("")),
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
type MfaValues = z.infer<typeof mfaSchema>;
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
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  const mfaForm = useForm<MfaValues>({ resolver: zodResolver(mfaSchema) });
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
      { label: "Porosi", value: orders.length, icon: ClipboardList }
    ],
    [categories.length, orders.length, products.length]
  );

  async function refresh() {
    const [nextCategories, nextProducts, nextOrders] = await loadAdminDashboard();
    setCategories(nextCategories);
    setProducts(nextProducts);
    setOrders(nextOrders);
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        const user = await getSessionUser();
        if (!cancelled) setAuthenticated(Boolean(user));
        if (user) {
          const [nextCategories, nextProducts, nextOrders] = await loadAdminDashboard();
          if (!cancelled) {
            setCategories(nextCategories);
            setProducts(nextProducts);
            setOrders(nextOrders);
          }
        }
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
      const challenge = await signInAdmin(values.email, values.password);
      setMfaChallenge(challenge);
      mfaForm.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kyçja dështoi.");
    }
  }

  async function onMfa(values: MfaValues) {
    if (!mfaChallenge) return;
    setError(null);
    try {
      const result = await verifyAdminMfa(mfaChallenge.challengeToken, values.code);
      setAuthenticated(Boolean(result.user));
      setMfaChallenge(null);
      setRecoveryCodes(result.recovery_codes ?? []);
      mfaForm.reset();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verifikimi dështoi.");
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
      const uploaded = file ? await uploadProductImage(file) : null;
      await upsertProduct({
        catalog_code: values.catalog_code || null,
        name: values.name,
        category_id: values.category_id,
        description: values.description,
        price_cents: values.price_cents,
        unit: values.unit,
        stock_label: values.stock_label,
        image_urls: !uploaded && values.image_url ? [values.image_url] : [],
        image_keys: uploaded ? [uploaded.key] : [],
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
    setError(null);
    try {
      await signOutAdmin();
      setAuthenticated(false);
      setMfaChallenge(null);
      setRecoveryCodes([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dalja dështoi.");
    }
  }

  async function advanceOrder(order: OrderRecord) {
    const next = order.status === "pending_whatsapp"
      ? "confirmed"
      : order.status === "confirmed"
        ? "completed"
        : null;
    if (!next) return;

    setError(null);
    try {
      await updateOrderStatus(order.id, next);
      await refresh();
      setNotice(next === "confirmed" ? "Porosia u konfirmua." : "Porosia u përfundua.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Statusi i porosisë nuk u ndryshua.");
    }
  }

  if (!hasApiConfig) {
    return (
      <section className="page-shell min-h-[64dvh]">
        <EmptyState
          icon={ShieldAlert}
          title="Admin kërkon API-në"
          description="Vendos VITE_API_BASE_URL në .env për të lidhur panelin me NestJS dhe Railway."
        />
      </section>
    );
  }

  if (loading) {
    return <section className="page-shell min-h-[64dvh]"><div className="surface h-96 animate-pulse bg-muted" /></section>;
  }

  if (authenticated && recoveryCodes.length > 0) {
    return (
      <section className="brand-ink flex min-h-[calc(100dvh-7rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-xl border-white/10 shadow-lift">
          <CardHeader>
            <ShieldCheck className="mb-4 h-10 w-10 text-accent" aria-hidden="true" />
            <CardTitle className="text-2xl">Ruani kodet e rikuperimit</CardTitle>
            <CardDescription>
              Këto kode shfaqen vetëm një herë. Ruajini jashtë këtij telefoni dhe mos i dërgoni me email.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid grid-cols-2 gap-2 rounded-md border bg-background/80 p-4 font-mono text-sm sm:grid-cols-2">
              {recoveryCodes.map((code) => <code key={code}>{code}</code>)}
            </div>
            <Button onClick={() => setRecoveryCodes([])}>I kam ruajtur kodet</Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!authenticated && mfaChallenge) {
    const enrollment = mfaChallenge.mode === "enroll" && mfaChallenge.setup;
    return (
      <section className="brand-ink flex min-h-[calc(100dvh-7rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-white/10 shadow-lift">
          <CardHeader>
            <KeyRound className="mb-4 h-10 w-10 text-accent" aria-hidden="true" />
            <CardTitle className="text-2xl">
              {enrollment ? "Aktivizo verifikimin me dy hapa" : "Shkruaj kodin e sigurisë"}
            </CardTitle>
            <CardDescription>
              {enrollment
                ? "Shto llogarinë në aplikacionin authenticator, pastaj shkruaj kodin 6-shifror."
                : "Përdor kodin nga authenticator-i ose një kod rikuperimi njëpërdorimësh."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {enrollment ? (
              <div className="grid gap-3 rounded-md border bg-background/80 p-4 text-sm">
                <p className="font-medium">Çelësi manual</p>
                <code className="break-all rounded bg-muted p-3 font-mono tracking-wider">
                  {mfaChallenge.setup?.secret}
                </code>
                <a className="font-semibold text-primary underline underline-offset-4" href={mfaChallenge.setup?.otpauthUri}>
                  Hape në aplikacionin authenticator
                </a>
              </div>
            ) : null}
            <form className="grid gap-4" onSubmit={mfaForm.handleSubmit(onMfa)}>
              <Field label="Kodi i sigurisë" error={mfaForm.formState.errors.code?.message}>
                <Input
                  autoComplete="one-time-code"
                  inputMode="text"
                  placeholder="123456 ose ABCD-EFGH-IJKL-MNPQ"
                  {...mfaForm.register("code")}
                />
              </Field>
              {error ? <p role="alert" className="text-sm font-medium text-destructive">{error}</p> : null}
              <Button type="submit" size="lg" className="w-full">Verifiko dhe vazhdo</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMfaChallenge(null);
                  setError(null);
                }}
              >
                Fillo përsëri
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!authenticated) {
    return (
      <section className="brand-ink flex min-h-[calc(100dvh-7rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-white/10 shadow-lift">
          <CardHeader>
            <img
              src="/brand/mr-clean-logo.png"
              alt="Mr. Clean"
              className="mb-5 h-12 w-auto self-start object-contain"
            />
            <CardTitle className="text-2xl">Kyçu në administratë</CardTitle>
            <CardDescription>Menaxho katalogun, porositë dhe kërkesat e klientëve.</CardDescription>
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
              <Button type="submit" size="lg" className="mt-2 w-full">Kyçu</Button>
            </form>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="page-shell min-h-[70dvh]">
      <div className="flex flex-col justify-between gap-5 border-b pb-7 md:flex-row md:items-end">
        <div>
          <p className="hairline-label">Paneli Mr. Clean</p>
          <h1 className="mt-4 text-4xl font-extrabold md:text-5xl">Administrata</h1>
          <p className="mt-2 text-sm text-muted-foreground">Katalogu, porositë dhe ofertat në një pamje.</p>
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((item) => (
          <Card key={item.label} className="border-t-2 border-t-primary shadow-none">
            <CardContent className="flex items-end justify-between p-5">
              <div>
                <p className="text-3xl font-extrabold tabular-nums">{item.value}</p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">{item.label}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary text-primary">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[380px_1fr] xl:items-start">
        <div className="grid gap-6">
          <Card className="shadow-none">
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

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Produkt i ri</CardTitle>
              <CardDescription>Çmimi ruhet në centë, p.sh. 8.90 EUR = 890.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={productForm.handleSubmit(onProductSubmit)}>
                <Field label="Kodi i katalogut" error={productForm.formState.errors.catalog_code?.message}>
                  <Input inputMode="numeric" maxLength={4} placeholder="p.sh. 0052" {...productForm.register("catalog_code")} />
                </Field>
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
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Produktet</CardTitle>
              <CardDescription>Aktivizo ose fshih produktet nga katalogu publik.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="border-b bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 font-semibold">Produkti</th>
                      <th className="px-3 py-3 font-semibold">Çmimi</th>
                      <th className="px-3 py-3 font-semibold">Statusi</th>
                      <th className="px-3 py-3 font-semibold">Tipi</th>
                      <th className="px-3 py-3 font-semibold">Veprim</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td className="px-3 py-4 font-semibold">
                          {product.catalog_code ? `${product.catalog_code} · ` : ""}{product.name}
                        </td>
                        <td className="px-3 py-4 tabular-nums">
                          {product.requires_quote ? "Me ofertë" : formatCurrency(product.price_cents)}
                        </td>
                        <td className="px-3 py-4">
                          <Badge variant={product.is_active ? "secondary" : "outline"}>
                            {product.is_active ? "Aktiv" : "Fshehur"}
                          </Badge>
                        </td>
                        <td className="px-3 py-4">
                          {product.requires_quote ? "Ofertë" : product.is_featured ? "Featured" : "Standard"}
                        </td>
                        <td className="px-3 py-4">
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

          <div>
            <LeadTable title="Porositë" empty="Ende nuk ka porosi." rows={orders.map((order) => ({
              id: order.id,
              title: `${order.reference} · ${order.customer_name}`,
              meta: `${order.company_name || "Pa biznes"} · ${formatCurrency(order.total_cents)}`,
              status: order.status,
              actionLabel: order.status === "pending_whatsapp"
                ? "Konfirmo"
                : order.status === "confirmed"
                  ? "Përfundo"
                  : undefined,
              onAction: () => advanceOrder(order)
            }))} />
          </div>
        </div>
      </div>
    </section>
  );
}

function loadAdminDashboard() {
  return Promise.all([
    getAdminCategories(),
    getAdminProducts(),
    getOrders()
  ]);
}

function LeadTable({
  title,
  empty,
  rows
}: {
  title: string;
  empty: string;
  rows: Array<{
    id: string;
    title: string;
    meta: string;
    status: string;
    actionLabel?: string;
    onAction?: () => void;
  }>;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="grid gap-3">
            {rows.map((row) => (
              <div key={row.id} className="border-b py-3 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{row.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{row.meta}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline">{row.status}</Badge>
                    {row.actionLabel && row.onAction ? (
                      <Button size="sm" variant="outline" onClick={row.onAction}>
                        {row.actionLabel}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
