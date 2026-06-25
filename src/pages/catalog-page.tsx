import { Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ProductCard } from "@/components/product-card";
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

  return (
    <section>
      <div className="brand-panel border-b">
        <div className="container py-10">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase text-cyan-200">Katalogu Mr. Clean</p>
              <h1 className="mt-3 text-4xl font-black leading-tight text-white md:text-5xl">
                Produkte për biznesin tuaj
              </h1>
              <p className="mt-4 max-w-2xl text-white/70">
                Katalog i thjeshtë për furnizim: filtro, shto në shportë dhe vazhdo porosinë në WhatsApp.
              </p>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-3 h-5 w-5 text-slate-500" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Kërko produkt..."
                className="border-white/20 bg-white pl-10"
                aria-label="Kërko produkt"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Filtro sipas kategorisë">
          <button
            type="button"
            onClick={() => setParams({})}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-4 text-sm font-bold",
              selected === "all" ? "border-primary bg-primary text-white" : "bg-white"
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
              className={cn(
                "h-11 shrink-0 rounded-md border px-4 text-sm font-bold",
                selected === category.slug
                  ? "border-primary bg-primary text-white"
                  : "bg-white text-slate-700 hover:border-primary/40"
              )}
            >
              {category.name}
            </button>
          ))}
        </div>

        {error ? (
          <EmptyState
            icon={Search}
            title="Nuk u lexua katalogu"
            description={error}
            className="mt-8"
          />
        ) : null}

        {loading ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="surface h-80 animate-pulse bg-muted" />
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
            title="Nuk ka produkte"
            description="Provoni një kategori tjetër ose ndryshoni kërkimin."
            className="mt-8"
          />
        )}
      </div>
    </section>
  );
}
