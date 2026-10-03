import type { Metadata } from "next";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { PilotFooter } from "../ui/PilotFooter";
import { PilotHeader } from "../ui/PilotHeader";
import { createPublicMetadata } from "../data/seo";
import { ComparePageClient } from "./ComparePageClient";

export const metadata: Metadata = createPublicMetadata({
  title:"Сравнение выбранного оборудования — 7TOOL",
  description:"Сравнение выбранных товаров по текущим ценам, наличию и рабочим характеристикам.",
  path:"/compare",
  indexable:false,
});

export default function ComparePage() {
  return <div className="site-shell"><PilotHeader /><main className="inner-page comparison-page">
    <div className="container"><Breadcrumbs items={[{ label:"Главная", href:"/" }, { label:"Каталог", href:"/catalog" }, { label:"Сравнение" }]} /></div>
    <ComparePageClient />
  </main><PilotFooter /></div>;
}
