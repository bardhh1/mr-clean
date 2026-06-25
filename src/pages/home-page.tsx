import {
  ArrowRight,
  Building2,
  MessageCircle,
  PackageCheck,
  Sparkles,
  Truck
} from "lucide-react";
import { Link } from "react-router-dom";
import { ProductCard } from "@/components/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCatalog } from "@/hooks/use-catalog";

const stats = [
  { label: "Për restorante", value: "HoReCa" },
  { label: "Porosi", value: "WhatsApp" },
  { label: "Pagesë", value: "Cash / bankë" }
];

const benefits = [
  {
    icon: Building2,
    title: "Për klientë biznesi",
    text: "Restorante, hotele, zyra dhe lokale marrin furnizim të rregullt pa komplikime."
  },
  {
    icon: PackageCheck,
    title: "Produkte të përditshme",
    text: "Nga letra dhe pecetat deri te kimikatet, aromat dhe aparatet për ambient."
  },
  {
    icon: Sparkles,
    title: "Peceta me logo",
    text: "Personalizim për tavolina dhe paketim me ofertë sipas sasisë dhe dizajnit."
  }
];

export function HomePage() {
  const { categories, products } = useCatalog();
  const featured = products.filter((product) => product.is_featured).slice(0, 4);

  return (
    <div className="bg-background">
      <section className="relative min-h-[calc(100dvh-72px)] overflow-hidden brand-ink">
        <img
          src="https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1800&q=85"
          alt="Pastrim profesional në ambient biznesi"
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,31,44,0.96),rgba(7,31,44,0.82),rgba(7,31,44,0.42))]" />
        <div className="container relative flex min-h-[calc(100dvh-72px)] flex-col justify-center py-14">
          <div className="max-w-3xl">
            <img
              src="/brand/mr-clean-logo.png"
              alt="Mr. Clean Cleaning Solution"
              className="h-20 w-auto rounded-lg bg-white px-4 py-3 shadow-lift"
            />
            <p className="mt-8 text-xs font-bold uppercase text-cyan-200">
              Furnizim sanitar për HoReCa dhe biznese
            </p>
            <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[0.95] text-white md:text-7xl">
              Higjienë që duket serioze para klientëve tuaj.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78">
              Peceta të personalizuara, kimikate pastrimi, produkte letre, aroma dhe artikuj hoteli
              me porosi të thjeshtë përmes WhatsApp.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-cyan-400 text-slate-950 hover:bg-cyan-300">
                <Link to="/produkte">
                  Shiko katalogun
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white hover:text-slate-950"
              >
                <Link to="/oferta/peceta">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  Peceta me logo
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="border-t border-white/20 pt-4">
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-white/64">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b bg-white">
        <div className="container grid gap-0 md:grid-cols-3">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="border-b py-7 md:border-b-0 md:border-r md:px-7 last:border-r-0">
              <benefit.icon className="h-7 w-7 text-primary" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-bold">{benefit.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{benefit.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="brand-panel">
        <div className="container py-14">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase text-cyan-200">Katalogu</p>
              <h2 className="mt-3 text-3xl font-black text-white md:text-4xl">
                Furnizim i qartë, jo listë e lodhur produktesh.
              </h2>
            </div>
            <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white hover:text-slate-950">
              <Link to="/produkte">Të gjitha kategoritë</Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {categories.map((category) => (
              <Link
                to={`/produkte?category=${category.slug}`}
                key={category.id}
                className="group block rounded-lg border border-white/12 bg-white/[0.06] p-5 transition-colors hover:border-cyan-300 hover:bg-white/[0.1]"
              >
                <Truck className="h-6 w-6 text-cyan-300" aria-hidden="true" />
                <h3 className="mt-4 font-bold text-white">{category.name}</h3>
                <p className="mt-2 text-sm leading-6 text-white/62">
                  {category.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-14">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Badge variant="secondary">Të zgjedhura</Badge>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">Produktet më të kërkuara</h2>
          </div>
          <Button asChild variant="outline">
            <Link to="/produkte">Shfleto katalogun</Link>
          </Button>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
