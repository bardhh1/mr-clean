import { PackageSearch, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/form";
import { useCatalog } from "@/hooks/use-catalog";
import { cn } from "@/lib/utils";

export function CatalogPage() {
  const { categories, products, loading, error } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const selected = params.get("category") ?? "all";

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const category = categories.find((item) => item.id === product.category_id);
      const matchesCategory = selected === "all" || category?.slug === selected;
      const searchable = `${product.name} ${product.description}`.toLowerCase();
      return matchesCategory && searchable.includes(query.toLowerCase());
    });
  }, [categories, products, query, selected]);

  const selectedCategory = categories.find((category) => category.slug === selected);

  return (
    <section className="min-h-[70dvh]">
      <div className="brand-ink border-b border-white/10">
        <div className="container grid gap-8 py-12 md:grid-cols-[1fr_0.7fr] md:items-end md:py-16">
          <div>
            <p className="flex items-center gap-3 text-xs font-bold uppercase text-cyan-300">
              <span className="h-px w-10 bg-cyan-300" />
              Katalogu Mr. Clean
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight text-white md:text-6xl">
              Furnizimi i biznesit, në një vend.
            </h1>
          </div>
          <p className="max-w-xl text-base leading-7 text-white/[0.68] md:justify-self-end">
            Kërko produktin, zgjidh sasinë dhe dërgo porosinë direkt në WhatsApp. Çdo porosi
            konfirmohet nga ekipi ynë.
          </p>
        </div>
      </div>

      <div className="sticky top-[76px] z-30 border-b bg-white/95 backdrop-blur-md sm:top-[112px]">
        <div className="container py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Kërko sipas emrit..."
                className="pl-11 pr-11"
                aria-label="Kërko produkt"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Pastro kërkimin"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0" aria-label="Filtro sipas kategorisë">
              <button
                type="button"
                onClick={() => setParams({})}
                aria-pressed={selected === "all"}
                className={cn(
                  "inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors",
                  selected === "all"
                    ? "border-foreground bg-foreground text-white"
                    : "bg-white text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                )}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Të gjitha
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setParams({ category: category.slug })}
                  aria-pressed={selected === category.slug}
                  className={cn(
                    "h-11 shrink-0 rounded-md border px-4 text-sm font-semibold transition-colors",
                    selected === category.slug
                      ? "border-foreground bg-foreground text-white"
                      : "bg-white text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  )}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="page-shell">
        <div className="flex flex-col justify-between gap-3 border-b pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase text-primary">{selectedCategory ? "Kategoria" : "Të gjitha kategoritë"}</p>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">
              {selectedCategory?.name ?? "Të gjitha produktet"}
            </h2>
          </div>
          <p className="text-sm font-medium tabular-nums text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "produkt" : "produkte"}
          </p>
        </div>

        {error ? (
          <EmptyState
            icon={PackageSearch}
            title="Nuk u lexua katalogu"
            description={error}
            className="mt-8"
          />
        ) : null}

        {loading ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="surface h-[420px] animate-pulse bg-muted" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title="Nuk gjetëm produkte"
            description="Provo një kategori tjetër ose ndrysho fjalët e kërkimit."
            className="mt-8"
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setParams({});
                }}
              >
                Pastro filtrat
              </Button>
            }
          />
        )}
      </div>
    </section>
  );
}
