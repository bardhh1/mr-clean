import { ArrowUpRight, Menu, MessageCircle, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/cart-context";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const navItems = [
  { href: "/", label: "Ballina", end: true },
  { href: "/produkte", label: "Produktet" }
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  const location = useLocation();
  const contactUrl = buildWhatsAppUrl(
    "Përshëndetje Mr. Clean, dua të marr më shumë informata për produktet tuaja."
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only z-[100] rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Kalo te përmbajtja
      </a>

      <div className="brand-ink hidden border-b border-white/10 sm:block">
        <div className="container flex h-9 items-center justify-between text-xs font-medium text-white/[0.72]">
          <p>Furnizim profesional për HoReCa, zyra dhe hotelieri</p>
          <a
            href={contactUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 text-white transition-colors hover:text-cyan-300"
          >
            Na kontaktoni në WhatsApp
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur-md">
        <div className="container flex h-[76px] items-center justify-between gap-5">
          <Link to="/" className="flex min-w-0 items-center" aria-label="Mr. Clean ballina">
            <img
              src="/brand/mr-clean-logo.png"
              alt="Mr. Clean Cleaning Solution"
              className="h-11 w-auto max-w-[172px] object-contain md:h-12 md:max-w-[188px]"
            />
          </Link>

          <nav className="hidden items-stretch self-stretch lg:flex" aria-label="Navigimi kryesor">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center px-4 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
                    isActive &&
                      "text-foreground after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:bg-primary"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="relative px-3 sm:px-4">
              <Link to="/shporta" aria-label={`Shporta, ${count} produkte`}>
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                <span className="hidden sm:inline">Shporta</span>
                {count > 0 ? (
                  <span className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold leading-4 text-white">
                    {count}
                  </span>
                ) : null}
              </Link>
            </Button>
            <Button asChild className="hidden xl:inline-flex">
              <a href={contactUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Na kontaktoni
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-navigation"
              aria-label={open ? "Mbyll menynë" : "Hap menynë"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {open ? (
          <div id="mobile-navigation" className="border-t bg-white lg:hidden">
            <nav className="container grid py-3" aria-label="Navigimi mobil">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-12 items-center justify-between border-b px-1 text-base font-semibold text-muted-foreground last:border-b-0",
                      isActive && "text-primary"
                    )
                  }
                >
                  {item.label}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </NavLink>
              ))}
              <a
                href={contactUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Na kontaktoni në WhatsApp
              </a>
            </nav>
          </div>
        ) : null}
      </header>

      <main id="main">
        <Outlet />
      </main>

      <footer className="brand-ink border-t border-white/10">
        <div className="container py-14 md:py-16">
          <div className="grid gap-10 border-b border-white/[0.12] pb-12 md:grid-cols-[1.5fr_0.8fr_0.8fr]">
            <div>
              <img
                src="/brand/mr-clean-logo.png"
                alt="Mr. Clean Cleaning Solution"
                className="h-14 w-auto rounded-md bg-white px-3 py-2"
              />
              <p className="mt-5 max-w-md text-sm leading-7 text-white/[0.66]">
                Produkte sanitare, kimikate pastrimi dhe aroma për biznese që duan standard të
                lartë çdo ditë.
              </p>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Navigimi</p>
              <div className="mt-4 grid gap-3 text-sm text-white/[0.66]">
                <Link className="hover:text-white" to="/produkte">Produktet</Link>
                <Link className="hover:text-white" to="/shporta">Shporta</Link>
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-white">Porositë</p>
              <p className="mt-4 text-sm leading-7 text-white/[0.66]">
                Porosia konfirmohet direkt me ekipin tonë përmes WhatsApp. Pagesa bëhet cash ose
                me transfer bankar.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-6 text-xs text-white/[0.45] sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Mr. Clean. Të gjitha të drejtat e rezervuara.</p>
            <Link className="hover:text-white" to="/admin">Hyrja e administratës</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
