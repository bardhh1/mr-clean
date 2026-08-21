import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export type RailItem = {
  number: string;
  label: string;
  meta?: string;
  href?: string;
  active?: boolean;
};

export function PosterFrame({
  children,
  rail,
  className
}: {
  children: React.ReactNode;
  rail: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("poster-frame", className)}>
      <div className="min-w-0">{children}</div>
      {rail}
    </div>
  );
}

export function ContextRail({ items, footer = "Pastërti · Higjienë · Biznes" }: { items: RailItem[]; footer?: string | null }) {
  return (
    <aside className="context-rail" aria-label="Navigimi kontekstual">
      <span className="locator-bar" aria-hidden="true" />
      <div className="context-rail__items">
        {items.map((item) => {
          const body = (
            <>
              <span className={cn("context-rail__number", item.active && "text-primary")}>{item.number}</span>
              <span className="context-rail__dash" aria-hidden="true">—</span>
              <span className={cn("context-rail__label", item.active && "font-bold text-primary")}>{item.label}</span>
              {item.meta ? <span className="context-rail__meta">{item.meta}</span> : null}
            </>
          );
          return item.href ? (
            <Link key={item.number} to={item.href} className={cn("context-rail__item", item.active && "is-active")}>
              {body}
            </Link>
          ) : (
            <div key={item.number} className={cn("context-rail__item", item.active && "is-active")}>
              {body}
            </div>
          );
        })}
      </div>
      {footer ? (
        <div className="context-rail__footer">
          <img src="/design/quality-stamp.png" alt="Pastërti profesionale, rezultate profesionale" />
          <span>{footer}</span>
        </div>
      ) : null}
    </aside>
  );
}

export function PageIntro({
  eyebrow = "Mr. Clean · Cleaning Solution",
  title,
  aside,
  className
}: {
  eyebrow?: string;
  title: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("page-intro", className)}>
      <div>
        <p className="poster-eyebrow"><span aria-hidden="true" />{eyebrow}</p>
        <h1 className="poster-title">{title}</h1>
      </div>
      {aside ? <div className="page-intro__aside">{aside}</div> : null}
    </header>
  );
}

export function TrustItem({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="trust-item">
      <Icon aria-hidden="true" />
      <div>
        <p>{title}</p>
        <span>{text}</span>
      </div>
    </div>
  );
}

export const categoryRailItems: RailItem[] = [
  { number: "01", label: "Peceta dhe letër", meta: "12", href: "/produkte?category=peceta-leter" },
  { number: "02", label: "Kimikate pastrimi", meta: "28", href: "/produkte?category=kimikate-pastrimi" },
  { number: "03", label: "Aroma dhe aparate", meta: "16", href: "/produkte?category=aroma-aparate" },
  { number: "04", label: "Hotelieri", meta: "14", href: "/produkte?category=hotelieri" }
];
