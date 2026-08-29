import { ArrowUpRight, House, Menu, MessageCircle, ShoppingCart, SprayCan, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useCart } from "@/context/cart-context";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Ballina", icon: House, end: true },
  { href: "/produkte", label: "Produktet", icon: SprayCan },
  { href: "/shporta", label: "Shporta", icon: ShoppingCart }
];
const mobileNavItems = navItems.filter((item) => item.href !== "/shporta");

export function Layout() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  const contactUrl = buildWhatsAppUrl("Përshëndetje Mr. Clean, dua më shumë informata për produktet tuaja.");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  if (isAdmin) {
    return (
      <div className="min-h-dvh bg-background">
        <header className="border-b bg-white">
          <div className="container flex min-h-20 items-center justify-between gap-5">
            <Link to="/" aria-label="Mr. Clean ballina">
              <img src="/brand/mr-clean-logo.png" alt="Mr. Clean Cleaning Solution" className="h-12 w-auto" />
            </Link>
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-primary">
              Shiko dyqanin <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </header>
        <main id="main"><Outlet /></main>
      </div>
    );
  }

  return (
    <div className="public-shell">
      <a href="#main" className="skip-link">Kalo te përmbajtja</a>

      <aside className="side-nav" aria-label="Navigimi kryesor">
        <Link to="/" className="side-nav__logo" aria-label="Mr. Clean ballina">
          <img src="/brand/mr-clean-logo.png" alt="Mr. Clean Cleaning Solution" />
        </Link>

        <nav className="side-nav__links">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.end}
                className={({ isActive }) => cn("side-nav__link", isActive && "is-active")}
              >
                <span className="relative">
                  <Icon aria-hidden="true" />
                  {item.href === "/shporta" && count > 0 ? <span className="cart-count">{count}</span> : null}
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <a className="side-nav__contact" href={contactUrl} target="_blank" rel="noreferrer">
          <span aria-hidden="true" />
          <MessageCircle aria-hidden="true" />
          <small>Na kontaktoni</small>
        </a>
      </aside>

      <header className="mobile-header">
        <Link to="/" aria-label="Mr. Clean ballina">
          <img src="/brand/mr-clean-logo.png" alt="Mr. Clean Cleaning Solution" />
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/shporta" className="mobile-cart" aria-label={`Shporta, ${count} artikuj`}>
            <ShoppingCart aria-hidden="true" />
            {count > 0 ? <span>{count}</span> : null}
          </Link>
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Mbyll menynë" : "Hap menynë"}>
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </header>

      {open ? (
        <div id="mobile-menu" className="mobile-menu">
          <nav aria-label="Navigimi mobil">
            {mobileNavItems.map((item) => (
              <NavLink key={item.href} to={item.href} end={item.end} onClick={() => setOpen(false)}>
                {item.label}<ArrowUpRight aria-hidden="true" />
              </NavLink>
            ))}
            <a href={contactUrl} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>Na kontaktoni në WhatsApp<MessageCircle aria-hidden="true" /></a>
          </nav>
        </div>
      ) : null}

      <main id="main" className="public-main"><Outlet /></main>
    </div>
  );
}
