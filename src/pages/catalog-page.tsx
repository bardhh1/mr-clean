import { PackageSearch, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ContextRail, PageIntro, PosterFrame } from "@/components/poster";
import { ProductCard } from "@/components/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { useCatalog } from "@/hooks/use-catalog";
import { cn } from "@/lib/utils";

export function CatalogPage() {
  const { categories, products, loading, error } = useCatalog();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const selected = params.get("category") ?? "all";

  const filtered = useMemo(() => products.filter((product) => {
    const category = categories.find((item) => item.id === product.category_id);
    const matchesCategory = selected === "all" || category?.slug === selected;
    const searchable = `${product.catalog_code ?? ""} ${product.name} ${product.description}`.toLowerCase();
    return matchesCategory && searchable.includes(query.trim().toLowerCase());
  }), [categories, products, query, selected]);

  const selectedCategory = categories.find((category) => category.slug === selected);
  const railItems = useMemo(() => categories.map((category, index) => ({
    number: String(index + 1).padStart(2, "0"),
    label: category.name,
    meta: String(products.filter((product) => product.category_id === category.id).length),
    href: `/produkte?category=${category.slug}`,
    active: selected === category.slug
  })), [categories, products, selected]);

  return (
    <PosterFrame className="catalog-frame" rail={<ContextRail items={railItems} footer={null} />}>
      <div className="catalog-page poster-page">
        <PageIntro title="Produktet" aside={<img src="/design/quality-stamp.png" alt="Pastërti profesionale" />} />

        <div className="catalog-search">
          <Search aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kërko produktin" aria-label="Kërko produkt" />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Pastro kërkimin"><X aria-hidden="true" /></button> : null}
        </div>

        <div className="mobile-category-filter" aria-label="Filtro sipas kategorisë">
          <button type="button" className={cn(selected === "all" && "is-active")} onClick={() => setParams({})}>Të gjitha</button>
          {categories.map((category) => (
            <button key={category.id} type="button" className={cn(selected === category.slug && "is-active")} onClick={() => setParams({ category: category.slug })}>
              {category.name}
            </button>
          ))}
        </div>

        <div className="catalog-toolbar">
          <div><span className="locator-bar" aria-hidden="true" /><strong>{selectedCategory?.name ?? "Të gjitha produktet"}</strong><i />{filtered.length} produkte</div>
          <span>Rendit sipas: <strong>Katalogut</strong></span>
        </div>

        {error ? <EmptyState icon={PackageSearch} title="Nuk u lexua katalogu" description={error} /> : null}

        {loading ? (
          <div className="product-grid" aria-label="Duke ngarkuar produktet">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="product-skeleton" />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="product-grid">
            {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <EmptyState icon={Search} title="Nuk gjetëm produkte" description="Provo një kategori tjetër ose ndrysho fjalët e kërkimit." />
        )}
      </div>
    </PosterFrame>
  );
}
