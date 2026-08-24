import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";
import { CategoryGrid } from "@/components/CategoryGrid";
import { BrandStrip } from "@/components/BrandStrip";
import { Bestsellers } from "@/components/Bestsellers";
import { TrustBlock } from "@/components/TrustBlock";
import { DarkCta } from "@/components/DarkCta";
import { WarehouseProof } from "@/components/WarehouseProof";
import { SiteFooter } from "@/components/SiteFooter";
import { indexableRobots, pageTitle } from "@/lib/seo-metadata";
import { absoluteUrl } from "@/lib/site-config";

export const metadata: Metadata = {
  title: pageTitle("7TOOL — промышленный инструмент для металлообработки"),
  description: "Промышленный инструмент и оборудование для металлообработки: 24 направления каталога, цены с НДС, наличие на складах в Москве и Санкт-Петербурге, доставка по России.",
  alternates: { canonical: "/" },
  robots: indexableRobots,
  openGraph: {
    url: "/",
    title: "7TOOL — промышленный инструмент для металлообработки",
    description: "24 направления промышленного инструмента, цены с НДС и наличие на складах.",
    images: [{ url: absoluteUrl("/og.png"), width: 1200, height: 630, alt: "Каталог промышленного инструмента 7TOOL" }],
  },
};

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <CategoryGrid />
        <BrandStrip />
        <Bestsellers />
        <WarehouseProof />
        <DarkCta />
        <TrustBlock />
      </main>
      <SiteFooter />
    </>
  );
}
