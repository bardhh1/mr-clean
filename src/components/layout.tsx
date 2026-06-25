import { Menu, ShoppingCart, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/cart-context";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Ballina" },
  { href: "/produkte", label: "Produktet" },
  { href: "/oferta/peceta", label: "Peceta me logo" },
  { href: "/admin", label: "Admin" }
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Kalo te përmbajtja
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="container flex h-[72px] items-center justify-between gap-4">
          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Mr. Clean ballina">
            <img
              src="/brand/mr-clean-logo.png"
              alt="Mr. Clean Cleaning Solution"
              className="h-12 w-auto max-w-[172px] object-contain"
            />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigimi kryesor">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    isActive && "bg-secondary text-primary"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="relative bg-white">
              <Link to="/shporta">
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                <span>Shporta</span>
                {count > 0 ? (
                  <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                    {count}
                  </span>
                ) : null}
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={open ? "Mbyll menynë" : "Hap menynë"}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {open ? (
          <nav className="border-t bg-white p-3 md:hidden" aria-label="Navigimi mobil">
            <div className="grid gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "rounded-md px-3 py-3 text-sm font-medium text-muted-foreground",
                      isActive && "bg-secondary text-primary"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        ) : null}
      </header>

      <main id="main">
        <Outlet />
      </main>

      <footer className="brand-ink border-t border-white/10">
        <div className="container grid gap-8 py-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <img
              src="/brand/mr-clean-logo.png"
              alt="Mr. Clean Cleaning Solution"
              className="h-14 w-auto rounded-md bg-white px-3 py-2"
            />
            <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
              Produkte sanitare, kimikate pastrimi dhe furnizim praktik për restorante, hotele,
              zyra dhe biznese në Kosovë.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white">Kategoritë</p>
            <div className="mt-3 grid gap-2 text-sm text-white/70">
              <Link to="/produkte">Peceta dhe letër</Link>
              <Link to="/produkte">Kimikate pastrimi</Link>
              <Link to="/produkte">Aroma dhe aparate</Link>
            </div>
          </div>
          <div>
            <p className="font-semibold text-white">Porositë</p>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Porositë dërgohen në WhatsApp dhe konfirmohen direkt me ekipin e Mr. Clean.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
