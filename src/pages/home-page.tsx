import { ArrowRight, Building2, CheckCircle2, MessageCircle, PackageCheck, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { PosterFrame, TrustItem } from "@/components/poster";
import { ProductCard } from "@/components/product-card";
import { useCatalog } from "@/hooks/use-catalog";

const orderSteps = [
  { number: "01", title: "Zgjidh artikujt", text: "Kërko në katalog, filtro sipas kategorisë dhe vendos sasinë që të duhet." },
  { number: "02", title: "Plotëso porosinë", text: "Shto kontaktin, adresën dhe mënyrën e preferuar të pagesës." },
  { number: "03", title: "Konfirmo në WhatsApp", text: "Ekipi ynë kontrollon stokun, transportin dhe kohën e dorëzimit." }
];

export function HomePage() {
  const { categories, products, loading } = useCatalog();
  const featured = products.filter((product) => product.is_featured).slice(0, 3);
  const categoryProducts = categories.map((category) => ({
    category,
    product: products.find((product) => product.category_id === category.id)
  }));

  return (
    <PosterFrame>
      <div className="home-poster">
        <div className="home-poster__stage">
          <p className="poster-eyebrow"><span aria-hidden="true" />Mr. Clean <i /> Cleaning Solution</p>
          <img src="/design/quality-stamp.png" alt="Pastërti profesionale, rezultate profesionale" className="quality-stamp" />
          <h1 className="hero-title">Furnizim<br />sanitar<br />për<br />biznese.</h1>

          <div className="hero-products" aria-hidden="true">
            <img src="/design/hero-products-catalog.webp" alt="" fetchPriority="high" />
          </div>
        </div>

        <div className="home-trust" aria-label="Përfitimet e shërbimit">
          <TrustItem icon={Building2} title="Furnizim për HoReCa dhe zyra" text="Zgjidhje profesionale për çdo ambient." />
          <TrustItem icon={Truck} title="Çmimet të dukshme në EUR" text="Transparencë dhe kursim për biznesin tuaj." />
          <TrustItem icon={MessageCircle} title="Porosi direkte në WhatsApp" text="Mbështetje e shpejtë dhe komunikim i drejtpërdrejtë." />
        </div>
      </div>

      <section className="home-section home-featured" aria-labelledby="featured-title">
        <header className="home-section__intro">
          <div>
            <p className="poster-eyebrow"><span aria-hidden="true" />Më të kërkuarat</p>
            <h2 id="featured-title">Produkte që<br />punojnë fort.</h2>
          </div>
          <div className="home-section__copy">
            <p>Artikujt bazë për pastërtinë e përditshme, të zgjedhur për ritmin e restoranteve, zyrave dhe hoteleve.</p>
            <Link to="/produkte">Shiko të gjithë katalogun <ArrowRight aria-hidden="true" /></Link>
          </div>
        </header>

        {loading ? (
          <div className="product-grid home-product-grid" aria-label="Duke ngarkuar produktet">
            {Array.from({ length: 3 }).map((_, index) => <div key={index} className="product-skeleton" />)}
          </div>
        ) : (
          <div className="product-grid home-product-grid">
            {featured.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}
      </section>

      <section className="home-section category-index" aria-labelledby="category-title">
        <header className="category-index__header">
          <p className="poster-eyebrow"><span aria-hidden="true" />Katalogu sipas nevojës</p>
          <h2 id="category-title">Çdo ambient.<br />Një standard.</h2>
          <p>Nga tavolina e restorantit te dhoma e hotelit—një furnizues i vetëm, pa humbur kohë.</p>
        </header>

        <div className="category-index__list">
          {categoryProducts.map(({ category, product }, index) => (
            <Link key={category.id} to={`/produkte?category=${category.slug}`} className="category-row" data-category={category.slug}>
              <span className="category-row__number">{String(index + 1).padStart(2, "0")}</span>
              <span className="category-row__image">{product ? <img src={product.image_urls[0]} alt="" /> : null}</span>
              <span className="category-row__content"><strong>{category.name}</strong><small>{category.description}</small></span>
              <ArrowRight aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section order-process" aria-labelledby="process-title">
        <div className="order-process__statement">
          <p className="poster-eyebrow poster-eyebrow--light"><span aria-hidden="true" />Porosi pa humbur kohë</p>
          <h2 id="process-title">Nga rafti<br />në derë.</h2>
          <p>Një proces i qartë për biznese që duan furnizim të rregullt, jo pengesa të panevojshme.</p>
          <Link to="/produkte" className="poster-cta poster-cta--light">Fillo porosinë <ArrowRight aria-hidden="true" /></Link>
        </div>

        <div className="order-process__steps">
          {orderSteps.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <div><h3>{step.title}</h3><p>{step.text}</p></div>
              <CheckCircle2 aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section className="home-final-cta" aria-labelledby="final-cta-title">
        <img src="/brand/mr-clean-logo.png" alt="Mr. Clean Cleaning Solution" />
        <div>
          <p className="poster-eyebrow"><span aria-hidden="true" />Furnizimi i radhës</p>
          <h2 id="final-cta-title">Gati kur është<br />biznesi juaj.</h2>
        </div>
        <div className="home-final-cta__action">
          <p>Çmime të qarta, produkte profesionale dhe konfirmim direkt me ekipin tonë.</p>
          <Link to="/produkte" className="poster-cta">Hap katalogun <PackageCheck aria-hidden="true" /></Link>
        </div>
      </section>
    </PosterFrame>
  );
}
