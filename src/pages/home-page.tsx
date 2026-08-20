import {
  ArrowRight,
  Building2,
  Check,
  Droplets,
  Hotel,
  MessageCircle,
  PackageCheck,
  ScrollText,
  SprayCan
} from "lucide-react";
import { Link } from "react-router-dom";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/hooks/use-catalog";

const categoryIcons = [ScrollText, Droplets, SprayCan, Hotel];

const trustPoints = [
  "Furnizim për HoReCa dhe zyra",
  "Çmime të dukshme në EUR",
  "Porosi direkte në WhatsApp"
];

const processSteps = [
  {
    number: "01",
    title: "Zgjidh produktet",
    text: "Kërko në katalog dhe vendos sasitë që i duhen biznesit tënd."
  },
  {
    number: "02",
    title: "Dërgo porosinë",
    text: "Plotëso kontaktin dhe porosia përgatitet automatikisht në WhatsApp."
  },
  {
    number: "03",
    title: "Konfirmo dorëzimin",
    text: "Ekipi ynë konfirmon stokun, transportin dhe mënyrën e pagesës."
  }
];

export function HomePage() {
  const { categories, products } = useCatalog();
  const featured = products.filter((product) => product.is_featured).slice(0, 4);

  return (
    <div>
      <section className="relative min-h-[640px] overflow-hidden brand-ink md:min-h-[700px]">
        <img
          src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=2000&q=88"
          alt="Ekip profesional duke pastruar një ambient biznesi"
          className="absolute inset-0 h-full w-full object-cover object-center"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-[#061c28]/80" />
        <div className="absolute inset-y-0 right-0 hidden w-[35%] border-l border-white/10 bg-[#0c3548]/50 lg:block" />

        <div className="container relative flex min-h-[640px] items-center py-16 md:min-h-[700px] md:py-20">
          <div className="max-w-4xl">
            <div className="flex items-center gap-3 text-xs font-bold uppercase text-cyan-300">
              <span className="h-px w-10 bg-cyan-300" />
              Mr. Clean · Cleaning Solution
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-extrabold leading-[0.98] text-white md:text-7xl">
              Furnizim sanitar për biznese.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/[0.72] md:text-xl">
              Produkte letre, kimikate pastrimi, aroma dhe artikuj hoteli. Të zgjedhura për
              ambiente ku pastërtia është pjesë e reputacionit.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-400 text-[#061c28] hover:bg-cyan-300 active:bg-cyan-200">
                <Link to="/produkte">
                  Shfleto produktet
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/5 text-white hover:border-white hover:bg-white hover:text-foreground"
              >
                <Link to="/oferta/peceta">Kërko peceta me logo</Link>
              </Button>
            </div>

            <div className="mt-12 grid max-w-4xl border-y border-white/[0.16] sm:grid-cols-3">
              {trustPoints.map((point) => (
                <div
                  key={point}
                  className="flex min-h-16 items-center gap-3 border-b border-white/[0.16] py-4 text-sm font-semibold text-white/[0.78] last:border-b-0 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0"
                >
                  <Check className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
                  {point}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="brand-mist border-b">
        <div className="section-shell">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div>
              <p className="hairline-label">Kategoritë</p>
              <h2 className="mt-5 text-3xl font-extrabold leading-tight md:text-5xl">
                Gjithçka për një ambient të pastër.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-7 text-muted-foreground lg:justify-self-end">
              Nga tavolina e restorantit deri te banjoja, kuzhina dhe aroma e ambientit. Një
              partner i vetëm për furnizimin e përditshëm.
            </p>
          </div>

          <div className="mt-10 grid border-l border-t sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category, index) => {
              const Icon = categoryIcons[index % categoryIcons.length];
              return (
                <Link
                  to={`/produkte?category=${category.slug}`}
                  key={category.id}
                  className="group min-h-64 border-b border-r bg-white p-6 transition-colors hover:bg-secondary/60"
                >
                  <div className="flex items-start justify-between">
                    <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="mt-14 text-xl font-bold leading-7">{category.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {category.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="section-shell">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="hairline-label">Më të kërkuarat</p>
              <h2 className="mt-5 text-3xl font-extrabold md:text-5xl">Zgjedhjet e bizneseve</h2>
            </div>
            <Button asChild variant="outline">
              <Link to="/produkte">
                Shiko të gjitha
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="relative min-h-[560px] overflow-hidden brand-ink">
        <img
          src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=2000&q=88"
          alt="Restorant i përgatitur me tavolina dhe peceta"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-[#061c28]/82" />
        <div className="section-shell relative flex min-h-[560px] items-center">
          <div className="max-w-2xl">
            <p className="flex items-center gap-3 text-xs font-bold uppercase text-cyan-300">
              <span className="h-px w-10 bg-cyan-300" />
              Personalizim për HoReCa
            </p>
            <h2 className="mt-5 text-4xl font-extrabold leading-[1.02] text-white md:text-6xl">
              Peceta që mbajnë emrin tuaj.
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/70">
              Dërgo logon, sasinë dhe formatin. Ne përgatisim ofertën sipas identitetit dhe
              ritmit të biznesit tënd.
            </p>
            <Button asChild size="lg" className="mt-8 bg-cyan-400 text-[#061c28] hover:bg-cyan-300">
              <Link to="/oferta/peceta">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                Fillo kërkesën
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="section-shell">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="hairline-label">Si funksionon</p>
              <h2 className="mt-5 text-3xl font-extrabold md:text-5xl">Porosi pa humbur kohë.</h2>
              <div className="mt-6 flex items-center gap-3 text-sm font-semibold text-muted-foreground">
                <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
                E ndërtuar për blerje biznesi
              </div>
            </div>
            <div className="border-t">
              {processSteps.map((step) => (
                <div key={step.number} className="grid gap-3 border-b py-7 sm:grid-cols-[64px_1fr_1.2fr] sm:items-start">
                  <span className="text-sm font-bold tabular-nums text-primary">{step.number}</span>
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{step.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 flex flex-col justify-between gap-6 border-t border-foreground/20 pt-8 md:flex-row md:items-center">
            <div className="flex items-start gap-4">
              <PackageCheck className="mt-1 h-7 w-7 shrink-0 text-accent" aria-hidden="true" />
              <div>
                <h3 className="text-xl font-bold">Gati për furnizimin e radhës?</h3>
                <p className="mt-1 text-sm text-muted-foreground">Zgjidh produktet dhe dërgo porosinë në pak minuta.</p>
              </div>
            </div>
            <Button asChild size="lg">
              <Link to="/produkte">Hap katalogun</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
