import type { ReactNode } from "react";
import Link from "next/link";
import { Breadcrumbs } from "./Breadcrumbs";
import { ManagerContactCard } from "./ManagerContactCard";
import { PilotFooter } from "./PilotFooter";
import { PilotHeader } from "./PilotHeader";

const informationLinks = [
  { href:"/company", label:"О компании" },
  { href:"/ordering", label:"Как заказать" },
  { href:"/payment", label:"Оплата" },
  { href:"/delivery", label:"Доставка" },
  { href:"/warranty", label:"Гарантия и документы" },
  { href:"/contacts", label:"Контакты" },
] as const;

export function PublicInfoPage({ currentPath, eyebrow, title, intro, asideTitle, asideText, heroVisual, children }: {
  currentPath: string;
  eyebrow: string;
  title: string;
  intro: string;
  asideTitle: string;
  asideText: string;
  heroVisual?: ReactNode;
  children: ReactNode;
}) {
  return <div className="site-shell">
    <PilotHeader />
    <main className="inner-page public-info-page">
      <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:title }]} /></div>
      <section className="public-info-hero">
        <div className="container">
          <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p></div>
          <div className="public-info-hero-visual">{heroVisual ?? <aside><span>Перед закупкой</span><b>{asideTitle}</b><p>{asideText}</p><Link href="/ordering">Посмотреть порядок работы →</Link></aside>}</div>
        </div>
      </section>
      <nav className="public-info-navigation" aria-label="Информация для покупателей">
        <div className="container">{informationLinks.map((item) => <Link href={item.href} aria-current={currentPath === item.href ? "page" : undefined} key={item.href}>{item.label}</Link>)}</div>
      </nav>
      {children}
    </main>
    <PilotFooter />
  </div>;
}

export function PublicInfoContact({ title, text, placement }: { title: string; text: string; placement: string }) {
  return <section className="section public-info-contact-section">
    <div className="container public-info-contact-grid">
      <div><p className="eyebrow">Контакт без переадресации</p><h2>{title}</h2><p>{text}</p></div>
      <ManagerContactCard compact placement={placement} />
    </div>
  </section>;
}
