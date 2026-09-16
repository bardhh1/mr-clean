import { zodResolver } from "@hookform/resolvers/zod";
import {
  Activity,
  Archive,
  ArrowRight,
  Boxes,
  ChartNoAxesCombined,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock3,
  KeyRound,
  LayoutDashboard,
  ListFilter,
  LogOut,
  PackageOpen,
  RefreshCw,
  Search,
  ShieldCheck,
  Tags,
  UsersRound
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { SalesChart } from "@/components/admin/sales-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import {
  getAdminSessions,
  regenerateAdminRecoveryCodes,
  signOutAllAdmin,
  updateProductStatus,
  uploadProductImage,
  upsertCategory,
  upsertProduct
} from "@/lib/admin";
import type { AdminSession, AdminUser } from "@/lib/admin";
import { getAdminCategories, getAdminProducts } from "@/lib/catalog";
import {
  getAuditEvents,
  getDashboardActivity,
  getDashboardSales,
  getDashboardSummary,
  getTopProducts
} from "@/lib/dashboard";
import type {
  ActivityItem,
  AuditEvent,
  DashboardRange,
  DashboardSummary,
  SalesPoint,
  TopProduct
} from "@/lib/dashboard";
import { formatCurrency } from "@/lib/format";
import { getOrders, updateOrderStatus } from "@/lib/orders";
import type { Category, OrderRecord, OrderStatus, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type Section = "overview" | "orders" | "catalog" | "activity" | "security";

const rangeLabels: Record<DashboardRange, string> = {
  "7d": "7 ditë",
  "30d": "30 ditë",
  "90d": "90 ditë",
  "12m": "12 muaj"
};

const sectionItems = [
  { id: "overview", label: "Përmbledhja", icon: LayoutDashboard },
  { id: "orders", label: "Porositë", icon: ClipboardList },
  { id: "catalog", label: "Katalogu", icon: Boxes },
  { id: "activity", label: "Aktiviteti", icon: Activity },
  { id: "security", label: "Siguria", icon: ShieldCheck }
] satisfies Array<{ id: Section; label: string; icon: typeof LayoutDashboard }>;

const nextOrderStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "confirmed",
  confirmed: "processing",
  processing: "shipped",
  shipped: "delivered"
};

const orderStatusLabels: Record<OrderStatus, string> = {
  pending: "Në pritje",
  confirmed: "E konfirmuar",
  processing: "Në përgatitje",
  shipped: "E nisur",
  delivered: "E dorëzuar",
  cancelled: "E anuluar"
};

const orderActionLabels: Partial<Record<OrderStatus, string>> = {
  pending: "Konfirmo",
  confirmed: "Fillo përgatitjen",
  processing: "Nis për dorëzim",
  shipped: "Shëno të dorëzuar"
};

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

const recoverySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Shkruani kodin aktual 6-shifror.")
});

type CategoryInput = z.input<typeof categorySchema>;
type CategoryValues = z.output<typeof categorySchema>;
type ProductInput = z.input<typeof productSchema>;
type ProductValues = z.output<typeof productSchema>;
type RecoveryValues = z.infer<typeof recoverySchema>;

export function AdminWorkspace({
  user,
  recoveryCodeUsed,
  onLogout,
  onSessionCleared,
  onRecoveryCodes
}: {
  user: AdminUser;
  recoveryCodeUsed: boolean;
  onLogout: () => Promise<void>;
  onSessionCleared: () => void;
  onRecoveryCodes: (codes: string[]) => void;
}) {
  const [section, setSection] = useState<Section>("overview");
  const [range, setRange] = useState<DashboardRange>("30d");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sales, setSales] = useState<SalesPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditHasMore, setAuditHasMore] = useState(false);
  const [auditAction, setAuditAction] = useState("");
  const [auditOutcome, setAuditOutcome] = useState<"" | "success" | "failure">("");
  const [auditTargetType, setAuditTargetType] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState<OrderStatus | "all">("all");

  const categoryForm = useForm<CategoryInput, unknown, CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { sort_order: 99 }
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
  const recoveryForm = useForm<RecoveryValues>({ resolver: zodResolver(recoverySchema) });

  const loadWorkspace = useCallback(async (selectedRange: DashboardRange, quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const interval = selectedRange === "12m" ? "month" : selectedRange === "90d" ? "week" : "day";
      const [
        nextSummary,
        nextSales,
        nextTopProducts,
        nextActivity,
        nextCategories,
        nextProducts,
        nextOrders,
        nextSessions,
        nextAudit
      ] = await Promise.all([
        getDashboardSummary(selectedRange),
        getDashboardSales(selectedRange, interval),
        getTopProducts(selectedRange),
        getDashboardActivity(),
        getAdminCategories(),
        getAdminProducts(),
        getOrders(),
        getAdminSessions(),
        getAuditEvents({ range: selectedRange })
      ]);
      setSummary(nextSummary);
      setSales(nextSales.data);
      setTopProducts(nextTopProducts.data);
      setActivity(nextActivity.data);
      setCategories(nextCategories);
      setProducts(nextProducts);
      setOrders(nextOrders);
      setSessions(nextSessions);
      setAuditEvents(nextAudit.data);
      setAuditCursor(nextAudit.meta.next_cursor);
      setAuditHasMore(nextAudit.meta.has_more);
    } catch (caught) {
      setError(errorMessage(caught, "Paneli nuk u ngarkua."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadWorkspace(range);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadWorkspace, range]);

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLocaleLowerCase("sq");
    return orders.filter((order) => {
      if (orderStatus !== "all" && order.status !== orderStatus) return false;
      if (!query) return true;
      return [order.reference, order.customer_name, order.company_name, order.city]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase("sq").includes(query));
    });
  }, [orderSearch, orderStatus, orders]);

  async function refreshAfterMutation(message: string) {
    await loadWorkspace(range, true);
    setNotice(message);
  }

  async function advanceOrder(order: OrderRecord) {
    const next = nextOrderStatus[order.status];
    if (!next) return;
    setNotice(null);
    setError(null);
    try {
      await updateOrderStatus(order.id, next);
      await refreshAfterMutation(`Porosia ${order.reference} u ndryshua në “${orderStatusLabels[next]}”.`);
    } catch (caught) {
      setError(errorMessage(caught, "Statusi i porosisë nuk u ndryshua."));
    }
  }

  async function cancelOrder(order: OrderRecord) {
    if (["delivered", "cancelled"].includes(order.status)) return;
    if (!window.confirm(`Anulo porosinë ${order.reference}? Ky veprim nuk mund të zhbëhet.`)) return;
    setNotice(null);
    setError(null);
    try {
      await updateOrderStatus(order.id, "cancelled");
      await refreshAfterMutation(`Porosia ${order.reference} u anulua.`);
    } catch (caught) {
      setError(errorMessage(caught, "Porosia nuk u anulua."));
    }
  }

  async function toggleProduct(product: Product) {
    setNotice(null);
    setError(null);
    try {
      await updateProductStatus(product.id, { is_active: !product.is_active });
      await refreshAfterMutation(product.is_active ? "Produkti u fsheh nga katalogu." : "Produkti u aktivizua.");
    } catch (caught) {
      setError(errorMessage(caught, "Statusi i produktit nuk u ndryshua."));
    }
  }

  async function saveCategory(values: CategoryValues) {
    setNotice(null);
    setError(null);
    try {
      await upsertCategory(values);
      categoryForm.reset({ sort_order: 99 });
      await refreshAfterMutation("Kategoria u ruajt.");
    } catch (caught) {
      setError(errorMessage(caught, "Kategoria nuk u ruajt."));
    }
  }

  async function saveProduct(values: ProductValues) {
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
      await refreshAfterMutation("Produkti u ruajt.");
    } catch (caught) {
      setError(errorMessage(caught, "Produkti nuk u ruajt."));
    }
  }

  async function regenerateCodes(values: RecoveryValues) {
    setNotice(null);
    setError(null);
    try {
      const result = await regenerateAdminRecoveryCodes(values.code);
      recoveryForm.reset();
      onRecoveryCodes(result.recoveryCodes);
    } catch (caught) {
      setError(errorMessage(caught, "Kodet e rikuperimit nuk u gjeneruan."));
    }
  }

  async function logoutEverywhere() {
    if (!window.confirm("Dil nga të gjitha pajisjet? Duhet të kyçeni përsëri me MFA.")) return;
    setError(null);
    try {
      await signOutAllAdmin();
      onSessionCleared();
    } catch (caught) {
      setError(errorMessage(caught, "Sesionet nuk u çaktivizuan."));
    }
  }

  async function applyAuditFilters() {
    setRefreshing(true);
    setError(null);
    try {
      const response = await getAuditEvents({
        range,
        action: auditAction.trim(),
        outcome: auditOutcome,
        targetType: auditTargetType.trim()
      });
      setAuditEvents(response.data);
      setAuditCursor(response.meta.next_cursor);
      setAuditHasMore(response.meta.has_more);
    } catch (caught) {
      setError(errorMessage(caught, "Historia e auditimit nuk u ngarkua."));
    } finally {
      setRefreshing(false);
    }
  }

  async function loadMoreAudit() {
    if (!auditCursor) return;
    setRefreshing(true);
    try {
      const response = await getAuditEvents({
        range,
        action: auditAction.trim(),
        outcome: auditOutcome,
        targetType: auditTargetType.trim(),
        cursor: auditCursor
      });
      setAuditEvents((current) => [...current, ...response.data]);
      setAuditCursor(response.meta.next_cursor);
      setAuditHasMore(response.meta.has_more);
    } catch (caught) {
      setError(errorMessage(caught, "Më shumë ngjarje nuk u ngarkuan."));
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return <WorkspaceLoading />;
  }

  return (
    <div className="admin-workspace min-h-[calc(100dvh-5rem)] bg-[#e9e7df]">
      <div className="mx-auto grid min-w-0 max-w-[1540px] grid-cols-[minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="admin-sidebar min-w-0 border-b border-white/10 bg-[#071d3d] text-white lg:sticky lg:top-0 lg:h-[calc(100dvh-5rem)] lg:border-b-0 lg:border-r">
          <div className="border-b border-white/10 px-5 py-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#b9ff00]">Qendra operative</p>
            <p className="mt-2 truncate text-sm text-white/70" title={user.email}>{user.email}</p>
          </div>
          <nav className="flex gap-2 overflow-x-auto p-3 lg:grid lg:overflow-visible" aria-label="Seksionet e administratës">
            {sectionItems.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-3 border px-4 py-3 text-left text-sm font-bold transition-colors",
                    active
                      ? "border-[#b9ff00] bg-[#b9ff00] text-[#071d3d]"
                      : "border-transparent text-white/75 hover:border-white/20 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="hidden border-t border-white/10 p-3 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
            <Button variant="ghost" className="w-full justify-start text-white hover:bg-white/10" onClick={() => void onLogout()}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Dil nga paneli
            </Button>
          </div>
        </aside>

        <main className="min-w-0 p-4 sm:p-6 xl:p-8">
          <header className="flex flex-col justify-between gap-5 border-b-2 border-[#071d3d] pb-6 md:flex-row md:items-end">
            <div>
              <p className="hairline-label">Mr. Clean · Administrata</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{sectionItems.find((item) => item.id === section)?.label}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{sectionDescription(section)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {section === "overview" || section === "activity" ? (
                <Select
                  aria-label="Periudha e raportimit"
                  className="w-36 bg-white"
                  value={range}
                  onChange={(event) => setRange(event.target.value as DashboardRange)}
                >
                  {Object.entries(rangeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              ) : null}
              <Button variant="outline" className="bg-white" onClick={() => void loadWorkspace(range, true)} disabled={refreshing}>
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden="true" />
                Rifresko
              </Button>
              <Button variant="outline" className="lg:hidden" onClick={() => void onLogout()}>
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Dil
              </Button>
            </div>
          </header>

          {notice ? <StatusBanner type="success" message={notice} onDismiss={() => setNotice(null)} /> : null}
          {error ? <StatusBanner type="error" message={error} onDismiss={() => setError(null)} /> : null}
          {recoveryCodeUsed ? (
            <StatusBanner
              type="warning"
              message="U përdor një kod rikuperimi. Gjeneroni një grup të ri sapo të keni qasje te authenticator-i."
            />
          ) : null}

          <div className="mt-6">
            {section === "overview" ? (
              <OverviewSection
                summary={summary}
                sales={sales}
                topProducts={topProducts}
                activity={activity}
                products={products}
                range={range}
                onNavigate={setSection}
              />
            ) : null}
            {section === "orders" ? (
              <OrdersSection
                orders={filteredOrders}
                totalOrders={orders.length}
                search={orderSearch}
                status={orderStatus}
                onSearch={setOrderSearch}
                onStatus={setOrderStatus}
                onAdvance={advanceOrder}
                onCancel={cancelOrder}
              />
            ) : null}
            {section === "catalog" ? (
              <CatalogSection
                categories={categories}
                products={products}
                categoryForm={categoryForm}
                productForm={productForm}
                onCategorySubmit={saveCategory}
                onProductSubmit={saveProduct}
                onToggleProduct={toggleProduct}
              />
            ) : null}
            {section === "activity" ? (
              <ActivitySection
                events={auditEvents}
                action={auditAction}
                outcome={auditOutcome}
                targetType={auditTargetType}
                hasMore={auditHasMore}
                loading={refreshing}
                onAction={setAuditAction}
                onOutcome={setAuditOutcome}
                onTargetType={setAuditTargetType}
                onApply={() => void applyAuditFilters()}
                onLoadMore={() => void loadMoreAudit()}
              />
            ) : null}
            {section === "security" ? (
              <SecuritySection
                sessions={sessions}
                recoveryForm={recoveryForm}
                onRegenerate={regenerateCodes}
                onLogout={() => void onLogout()}
                onLogoutAll={() => void logoutEverywhere()}
              />
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function OverviewSection({
  summary,
  sales,
  topProducts,
  activity,
  products,
  range,
  onNavigate
}: {
  summary: DashboardSummary | null;
  sales: SalesPoint[];
  topProducts: TopProduct[];
  activity: ActivityItem[];
  products: Product[];
  range: DashboardRange;
  onNavigate: (section: Section) => void;
}) {
  const cards = [
    { label: "Të ardhura të dorëzuara", value: formatCurrency(summary?.revenue_cents ?? 0), icon: ChartNoAxesCombined },
    { label: "Porosi të dorëzuara", value: String(summary?.delivered_order_count ?? 0), icon: CheckCircle2 },
    { label: "Vlera mesatare", value: formatCurrency(summary?.average_order_value_cents ?? 0), icon: ClipboardList },
    { label: "Porosi të krijuara", value: String(summary?.orders_created ?? 0), icon: PackageOpen }
  ];
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label} className="border-t-4 border-t-primary shadow-none">
            <CardContent className="flex items-start justify-between gap-4 p-5">
              <div>
                <p className="text-2xl font-black tabular-nums xl:text-3xl">{card.value}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{card.label}</p>
              </div>
              <span className="border border-primary bg-secondary p-2.5 text-primary"><card.icon className="h-5 w-5" aria-hidden="true" /></span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.7fr)]">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div><CardTitle>Shitjet e dorëzuara</CardTitle><CardDescription>Vetëm porositë COD të dorëzuara gjatë {rangeLabels[range].toLowerCase()}.</CardDescription></div>
            <Badge variant="outline">Europe/Belgrade</Badge>
          </CardHeader>
          <CardContent><SalesChart data={sales} /></CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader><CardTitle>Statuset e porosive</CardTitle><CardDescription>Gjendja aktuale e porosive të krijuara në periudhë.</CardDescription></CardHeader>
          <CardContent className="grid gap-2">
            {(Object.keys(orderStatusLabels) as OrderStatus[]).map((status) => (
              <div key={status} className="flex items-center justify-between border-b py-2.5 last:border-0">
                <span className="text-sm font-medium">{orderStatusLabels[status]}</span>
                <strong className="tabular-nums">{summary?.orders_by_status[status] ?? 0}</strong>
              </div>
            ))}
            <Button variant="outline" className="mt-2" onClick={() => onNavigate("orders")}>Menaxho porositë <ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-3">
        <Card className="shadow-none xl:col-span-2">
          <CardHeader><CardTitle>Produktet kryesore</CardTitle><CardDescription>Renditur sipas të ardhurave nga porositë e dorëzuara.</CardDescription></CardHeader>
          <CardContent>
            {topProducts.length ? (
              <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm">
                <thead className="border-b bg-muted"><tr><th className="px-3 py-3">Produkti</th><th className="px-3 py-3 text-right">Njësi</th><th className="px-3 py-3 text-right">Porosi</th><th className="px-3 py-3 text-right">Të ardhura</th></tr></thead>
                <tbody className="divide-y">{topProducts.map((product, index) => (
                  <tr key={`${product.product_id ?? product.name}-${index}`}><td className="px-3 py-3 font-semibold">{product.name}<span className="ml-2 text-xs font-normal text-muted-foreground">/{product.unit}</span></td><td className="px-3 py-3 text-right tabular-nums">{product.units_sold}</td><td className="px-3 py-3 text-right tabular-nums">{product.order_count}</td><td className="px-3 py-3 text-right font-bold tabular-nums">{formatCurrency(product.revenue_cents)}</td></tr>
                ))}</tbody>
              </table></div>
            ) : <p className="text-sm text-muted-foreground">Nuk ka ende produkte nga porosi të dorëzuara në këtë periudhë.</p>}
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader><CardTitle>Aktiviteti i fundit</CardTitle><CardDescription>Porosi të reja dhe veprime administrative.</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            {activity.slice(0, 7).map((item) => <ActivityRow key={`${item.kind}-${item.id}`} item={item} />)}
            {!activity.length ? <p className="text-sm text-muted-foreground">Nuk ka aktivitet për t’u shfaqur.</p> : null}
            <Button variant="outline" onClick={() => onNavigate("activity")}>Shiko auditimin <ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed bg-[#f6f4ed] shadow-none">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="border border-primary bg-white p-3 text-primary"><Archive className="h-6 w-6" aria-hidden="true" /></span>
          <div className="flex-1"><p className="font-black">Inventari aktivizohet në Fazën 12</p><p className="mt-1 text-sm text-muted-foreground">Sasitë, rezervimet dhe alarmet e stokut do të shtohen pasi të verifikohen sasite reale në fabrikë. Deri atëherë paneli nuk paraqet vlera të rreme.</p></div>
          <Badge variant="outline">{products.length} produkte në katalog</Badge>
        </CardContent>
      </Card>
    </div>
  );
}

function OrdersSection({ orders, totalOrders, search, status, onSearch, onStatus, onAdvance, onCancel }: {
  orders: OrderRecord[];
  totalOrders: number;
  search: string;
  status: OrderStatus | "all";
  onSearch: (value: string) => void;
  onStatus: (value: OrderStatus | "all") => void;
  onAdvance: (order: OrderRecord) => Promise<void>;
  onCancel: (order: OrderRecord) => Promise<void>;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="border-b">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div><CardTitle>Rrjedha e porosive</CardTitle><CardDescription>{totalOrders} porosi të fundit · përditësoni statusin sipas punës reale.</CardDescription></div>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_180px]">
            <label className="relative"><span className="sr-only">Kërko porosi</span><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" aria-hidden="true" /><Input className="bg-white pl-10" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Referenca, klienti, qyteti…" /></label>
            <Select aria-label="Filtro sipas statusit" className="bg-white" value={status} onChange={(event) => onStatus(event.target.value as OrderStatus | "all")}><option value="all">Të gjitha statuset</option>{(Object.keys(orderStatusLabels) as OrderStatus[]).map((value) => <option key={value} value={value}>{orderStatusLabels[value]}</option>)}</Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {orders.length ? <div className="divide-y">{orders.map((order) => (
          <article key={order.id} className="grid gap-4 p-5 transition-colors hover:bg-muted/30 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{order.reference}</h3><OrderStatusBadge status={order.status} /><span className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</span></div>
              <p className="mt-2 font-semibold">{order.customer_name}{order.company_name ? ` · ${order.company_name}` : ""}</p>
              <p className="mt-1 text-sm text-muted-foreground">{order.city} · {order.customer_email ?? "Pa email"} · {formatCurrency(order.total_cents)}</p>
              {order.notes ? <p className="mt-2 line-clamp-2 text-sm">Shënim: {order.notes}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2 xl:justify-end">
              {orderActionLabels[order.status] ? <Button size="sm" onClick={() => void onAdvance(order)}>{orderActionLabels[order.status]} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Button> : null}
              {!["delivered", "cancelled"].includes(order.status) ? <Button size="sm" variant="destructive" onClick={() => void onCancel(order)}>Anulo</Button> : null}
            </div>
          </article>
        ))}</div> : <EmptyState className="m-5" icon={PackageOpen} title="Nuk u gjet asnjë porosi" description="Ndryshoni kërkimin ose filtrin e statusit." />}
      </CardContent>
    </Card>
  );
}

function CatalogSection({ categories, products, categoryForm, productForm, onCategorySubmit, onProductSubmit, onToggleProduct }: {
  categories: Category[];
  products: Product[];
  categoryForm: ReturnType<typeof useForm<CategoryInput, unknown, CategoryValues>>;
  productForm: ReturnType<typeof useForm<ProductInput, unknown, ProductValues>>;
  onCategorySubmit: (values: CategoryValues) => Promise<void>;
  onProductSubmit: (values: ProductValues) => Promise<void>;
  onToggleProduct: (product: Product) => Promise<void>;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-[380px_minmax(0,1fr)] 2xl:items-start">
      <div className="grid gap-6">
        <Card className="shadow-none"><CardHeader><Tags className="h-6 w-6 text-primary" aria-hidden="true" /><CardTitle>Kategori e re</CardTitle><CardDescription>Shto një grup të ri për filtrat e katalogut.</CardDescription></CardHeader><CardContent><form className="grid gap-4" onSubmit={categoryForm.handleSubmit(onCategorySubmit)}><Field label="Emri" error={categoryForm.formState.errors.name?.message}><Input {...categoryForm.register("name")} /></Field><Field label="Përshkrimi" error={categoryForm.formState.errors.description?.message}><Textarea {...categoryForm.register("description")} /></Field><Field label="Renditja" error={categoryForm.formState.errors.sort_order?.message}><Input type="number" {...categoryForm.register("sort_order")} /></Field><Button type="submit" disabled={categoryForm.formState.isSubmitting}>{categoryForm.formState.isSubmitting ? "Duke ruajtur…" : "Ruaj kategorinë"}</Button></form></CardContent></Card>
        <Card className="shadow-none"><CardHeader><Boxes className="h-6 w-6 text-primary" aria-hidden="true" /><CardTitle>Produkt i ri</CardTitle><CardDescription>Çmimi ruhet në centë: 8.90 EUR = 890.</CardDescription></CardHeader><CardContent><form className="grid gap-4" onSubmit={productForm.handleSubmit(onProductSubmit)}>
          <Field label="Kodi i katalogut" error={productForm.formState.errors.catalog_code?.message}><Input inputMode="numeric" maxLength={4} placeholder="p.sh. 0052" {...productForm.register("catalog_code")} /></Field>
          <Field label="Emri" error={productForm.formState.errors.name?.message}><Input {...productForm.register("name")} /></Field>
          <Field label="Kategoria" error={productForm.formState.errors.category_id?.message}><Select {...productForm.register("category_id")}><option value="">Zgjedh kategorinë</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</Select></Field>
          <Field label="Përshkrimi" error={productForm.formState.errors.description?.message}><Textarea {...productForm.register("description")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Çmimi në centë" error={productForm.formState.errors.price_cents?.message}><Input type="number" min={0} {...productForm.register("price_cents")} /></Field><Field label="Njësia" error={productForm.formState.errors.unit?.message}><Input {...productForm.register("unit")} /></Field></div>
          <Field label="Etiketa e stokut" error={productForm.formState.errors.stock_label?.message}><Input {...productForm.register("stock_label")} /></Field>
          <Field label="URL e imazhit" error={productForm.formState.errors.image_url?.message}><Input type="url" {...productForm.register("image_url")} /></Field>
          <Field label="Ose ngarko imazh" error={String(productForm.formState.errors.image_file?.message ?? "")}><Input type="file" accept="image/*" {...productForm.register("image_file")} /></Field>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" className="h-5 w-5" {...productForm.register("is_featured")} /> Produkt i zgjedhur</label>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" className="h-5 w-5" {...productForm.register("requires_quote")} /> Kërkon ofertë</label>
          <Button type="submit" disabled={productForm.formState.isSubmitting}>{productForm.formState.isSubmitting ? "Duke ruajtur…" : "Ruaj produktin"}</Button>
        </form></CardContent></Card>
      </div>
      <Card className="shadow-none"><CardHeader><CardTitle>Produktet</CardTitle><CardDescription>{products.length} produkte · aktivizoni ose fshihni nga katalogu publik.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b bg-muted"><tr><th className="px-3 py-3">Produkti</th><th className="px-3 py-3">Kategoria</th><th className="px-3 py-3">Çmimi</th><th className="px-3 py-3">Statusi</th><th className="px-3 py-3">Veprim</th></tr></thead><tbody className="divide-y">{products.map((product) => <tr key={product.id}><td className="px-3 py-4 font-bold">{product.catalog_code ? `${product.catalog_code} · ` : ""}{product.name}</td><td className="px-3 py-4">{categories.find((category) => category.id === product.category_id)?.name ?? "—"}</td><td className="px-3 py-4 tabular-nums">{product.requires_quote ? "Me ofertë" : formatCurrency(product.price_cents)}</td><td className="px-3 py-4"><Badge variant={product.is_active ? "secondary" : "outline"}>{product.is_active ? "Aktiv" : "Fshehur"}</Badge></td><td className="px-3 py-4"><Button size="sm" variant="outline" onClick={() => void onToggleProduct(product)}>{product.is_active ? "Fshih" : "Aktivizo"}</Button></td></tr>)}</tbody></table></div></CardContent></Card>
    </div>
  );
}

function ActivitySection({ events, action, outcome, targetType, hasMore, loading, onAction, onOutcome, onTargetType, onApply, onLoadMore }: {
  events: AuditEvent[];
  action: string;
  outcome: "" | "success" | "failure";
  targetType: string;
  hasMore: boolean;
  loading: boolean;
  onAction: (value: string) => void;
  onOutcome: (value: "" | "success" | "failure") => void;
  onTargetType: (value: string) => void;
  onApply: () => void;
  onLoadMore: () => void;
}) {
  return <Card className="shadow-none"><CardHeader className="border-b"><div className="flex flex-col justify-between gap-4"><div><CardTitle>Regjistri i auditimit</CardTitle><CardDescription>Historik append-only i veprimeve administrative dhe rezultateve.</CardDescription></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[220px_180px_160px_auto]"><Input value={action} onChange={(event) => onAction(event.target.value)} placeholder="p.sh. order.status.updated" aria-label="Filtro sipas veprimit" /><Input value={targetType} onChange={(event) => onTargetType(event.target.value)} placeholder="p.sh. order" aria-label="Filtro sipas llojit të objektit" /><Select value={outcome} onChange={(event) => onOutcome(event.target.value as "" | "success" | "failure")} aria-label="Filtro sipas rezultatit"><option value="">Çdo rezultat</option><option value="success">Sukses</option><option value="failure">Dështim</option></Select><Button onClick={onApply} disabled={loading}><ListFilter className="h-4 w-4" aria-hidden="true" /> Filtro</Button></div></div></CardHeader><CardContent className="p-0">{events.length ? <div className="divide-y">{events.map((event) => <article key={event.id} className="grid gap-3 p-5 lg:grid-cols-[minmax(0,1fr)_auto]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><code className="break-all text-sm font-black">{event.action}</code><Badge variant={event.outcome === "success" ? "secondary" : "outline"}>{event.outcome === "success" ? "Sukses" : "Dështim"}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{event.target_type ?? "sistem"}{event.target_id ? ` · ${event.target_id}` : ""}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{event.request_id ? <span>Kërkesa: {event.request_id}</span> : null}{event.session_id ? <span>Sesioni: …{event.session_id.slice(-8)}</span> : null}{event.ip_hash ? <span>IP hash: {event.ip_hash.slice(0, 12)}…</span> : null}</div>{event.user_agent || Object.keys(event.metadata).length ? <details className="mt-3 text-xs"><summary className="cursor-pointer font-semibold text-primary">Konteksti i sigurt</summary><div className="mt-2 grid gap-2 border bg-muted/30 p-3">{event.user_agent ? <p className="break-words"><strong>Shfletuesi:</strong> {event.user_agent}</p> : null}{Object.keys(event.metadata).length ? <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono">{JSON.stringify(event.metadata, null, 2)}</pre> : null}</div></details> : null}</div><time className="text-sm font-semibold text-muted-foreground" dateTime={event.occurred_at}>{formatDateTime(event.occurred_at)}</time></article>)}</div> : <EmptyState className="m-5" icon={Activity} title="Nuk ka ngjarje" description="Nuk u gjetën ngjarje për filtrat dhe periudhën e zgjedhur." />}{hasMore ? <div className="border-t p-4 text-center"><Button variant="outline" onClick={onLoadMore} disabled={loading}>{loading ? "Duke ngarkuar…" : "Ngarko më shumë"}</Button></div> : null}</CardContent></Card>;
}

function SecuritySection({ sessions, recoveryForm, onRegenerate, onLogout, onLogoutAll }: {
  sessions: AdminSession[];
  recoveryForm: ReturnType<typeof useForm<RecoveryValues>>;
  onRegenerate: (values: RecoveryValues) => Promise<void>;
  onLogout: () => void;
  onLogoutAll: () => void;
}) {
  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)] xl:items-start"><Card className="shadow-none"><CardHeader><UsersRound className="h-6 w-6 text-primary" aria-hidden="true" /><CardTitle>Sesionet aktive</CardTitle><CardDescription>Pajisjet e autentikuara me fjalëkalim dhe MFA.</CardDescription></CardHeader><CardContent className="grid gap-3">{sessions.map((session) => <div key={session.id} className="border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><strong>Sesioni …{session.id.slice(-8)}</strong>{session.current ? <Badge variant="secondary">Ky sesion</Badge> : null}</div><span className="text-xs text-muted-foreground">Aktiv {formatRelativeTime(session.last_used_at)}</span></div><div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2"><span>MFA: {formatDateTime(session.mfa_verified_at)}</span><span>Skadon: {formatDateTime(session.expires_at)}</span></div></div>)}{!sessions.length ? <p className="text-sm text-muted-foreground">Nuk ka sesione aktive.</p> : null}<div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" onClick={onLogout}><LogOut className="h-4 w-4" aria-hidden="true" /> Dil nga ky sesion</Button><Button variant="destructive" onClick={onLogoutAll}>Dil nga të gjitha pajisjet</Button></div></CardContent></Card><div className="grid gap-6"><Card className="shadow-none"><CardHeader><KeyRound className="h-6 w-6 text-primary" aria-hidden="true" /><CardTitle>Kodet e rikuperimit</CardTitle><CardDescription>Gjenerimi i ri çaktivizon të gjitha kodet e mëparshme dhe kërkon kod të freskët TOTP.</CardDescription></CardHeader><CardContent><form className="grid gap-4" onSubmit={recoveryForm.handleSubmit(onRegenerate)}><Field label="Kodi aktual nga authenticator-i" error={recoveryForm.formState.errors.code?.message}><Input autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="123456" {...recoveryForm.register("code")} /></Field><Button type="submit" variant="outline" disabled={recoveryForm.formState.isSubmitting}>{recoveryForm.formState.isSubmitting ? "Duke gjeneruar…" : "Gjenero kode të reja"}</Button></form></CardContent></Card><Card className="border-amber-400 bg-amber-50 shadow-none"><CardHeader><CircleAlert className="h-6 w-6 text-amber-700" aria-hidden="true" /><CardTitle>Praktika e sigurt</CardTitle><CardDescription className="text-amber-950">Mos ruani fjalëkalimin, kodet TOTP ose kodet e rikuperimit në shfletues, email apo mesazhe. Mbani vetëm një administrator aktiv.</CardDescription></CardHeader></Card></div></div>;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return <div className="flex gap-3 border-b pb-3 last:border-0 last:pb-0"><span className="mt-0.5 border bg-muted p-1.5"><Clock3 className="h-4 w-4 text-primary" aria-hidden="true" /></span><div className="min-w-0"><p className="break-words text-sm font-semibold">{humanizeAction(item.action)}</p><p className="mt-1 text-xs text-muted-foreground">{item.target_id ?? item.target_type ?? "Sistem"} · {formatRelativeTime(item.occurred_at)}</p></div></div>;
}

function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={status === "delivered" ? "secondary" : "outline"} className={status === "cancelled" ? "border-destructive text-destructive" : undefined}>{orderStatusLabels[status]}</Badge>;
}

function StatusBanner({ type, message, onDismiss }: { type: "success" | "error" | "warning"; message: string; onDismiss?: () => void }) {
  const Icon = type === "success" ? CheckCircle2 : CircleAlert;
  return <div role={type === "error" ? "alert" : "status"} className={cn("mt-5 flex items-start gap-3 border p-4 text-sm", type === "success" && "border-green-700 bg-green-50 text-green-950", type === "error" && "border-destructive bg-red-50 text-destructive", type === "warning" && "border-amber-500 bg-amber-50 text-amber-950")}><Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><p className="flex-1 font-medium">{message}</p>{onDismiss ? <button type="button" className="font-bold underline" onClick={onDismiss}>Mbyll</button> : null}</div>;
}

function WorkspaceLoading() {
  return <div className="min-h-[calc(100dvh-5rem)] bg-[#e9e7df] p-4 sm:p-8" role="status"><span className="sr-only">Duke ngarkuar panelin</span><div className="mx-auto grid max-w-[1280px] gap-4"><div className="h-20 animate-pulse bg-muted" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse border bg-white" />)}</div><div className="h-96 animate-pulse border bg-white" /></div></div>;
}

function sectionDescription(section: Section) {
  return ({
    overview: "Të ardhurat, porositë dhe performanca operative në një pamje.",
    orders: "Përpunoni porositë nga konfirmimi deri te dorëzimi.",
    catalog: "Menaxhoni produktet dhe kategoritë e dyqanit publik.",
    activity: "Kontrolloni gjurmën e pandryshueshme të veprimeve administrative.",
    security: "Mbikëqyrni sesionet, MFA-në dhe qasjen administrative."
  })[section];
}

function humanizeAction(action: string) {
  const labels: Record<string, string> = {
    "order.created": "Porosi e re",
    "order.status.updated": "Statusi i porosisë u ndryshua",
    "admin.login.succeeded": "Kyçje administrative",
    "admin.logout": "Dalje administrative",
    "product.created": "Produkt i ri",
    "product.updated": "Produkti u përditësua",
    "category.created": "Kategori e re",
    "category.updated": "Kategoria u përditësua"
  };
  return labels[action] ?? action.replaceAll(".", " · ");
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("sq-XK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Belgrade"
  }).format(new Date(value));
}

function formatRelativeTime(value: string) {
  const deltaMinutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat("sq", { numeric: "auto" });
  if (Math.abs(deltaMinutes) < 60) return formatter.format(deltaMinutes, "minute");
  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) return formatter.format(deltaHours, "hour");
  return formatter.format(Math.round(deltaHours / 24), "day");
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
