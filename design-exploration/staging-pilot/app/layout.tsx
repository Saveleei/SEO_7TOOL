import type { Metadata } from "next";
import "./globals.css";
import { ContactAnalytics } from "./ui/ContactAnalytics";
import { ConversionAnalytics } from "./ui/ConversionAnalytics";
import { DocumentNavigationFallback } from "./ui/DocumentNavigationFallback";
import { JsonLd } from "./ui/JsonLd";
import { YandexMetrika } from "./ui/YandexMetrika";
import { WebVitalsAnalytics } from "./ui/WebVitalsAnalytics";
import { AttributionCapture } from "./ui/AttributionCapture";
import { RequestCartProvider } from "./ui/RequestCart";
import { ComparisonProvider } from "./ui/Comparison";
import { siteCompany, siteContact } from "./data/contactConfig";
import { DEFAULT_SOCIAL_IMAGE, publicRobots } from "./data/seo";
import { resolveYandexMetrikaId } from "./data/analyticsConfig.mjs";

export const metadata: Metadata = {
  metadataBase: new URL("https://7tool.ru"),
  title: "7TOOL — промышленное оборудование и оснастка для металлообработки",
  description: "Промышленное оборудование и оснастка для сверления, резки, обработки кромки и сварочной автоматизации. Инженерный подбор, КП с НДС и доставка по России.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url:"/favicon.ico", sizes:"any" },
      { url:"/favicon.svg", type:"image/svg+xml" },
      { url:"/favicon-32x32.png", type:"image/png", sizes:"32x32" },
      { url:"/favicon-16x16.png", type:"image/png", sizes:"16x16" },
    ],
    shortcut:"/favicon.ico",
    apple:[{ url:"/apple-touch-icon.png", type:"image/png", sizes:"180x180" }],
  },
  robots: publicRobots(),
  openGraph: {
    title: "7TOOL — промышленное оборудование и оснастка",
    description: "Инженерный подбор оборудования для металлообработки, КП с НДС и доставка по России.",
    siteName:"7TOOL",
    locale:"ru_RU",
    type:"website",
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: { card: "summary_large_image", title: "7TOOL — промышленное оборудование и оснастка", description: "Инженерный подбор оборудования для металлообработки, КП с НДС и доставка по России.", images: [{ url:DEFAULT_SOCIAL_IMAGE.url, alt:DEFAULT_SOCIAL_IMAGE.alt }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const forceDocumentNavigation = process.env.FORCE_DOCUMENT_NAVIGATION !== "0";
  const metrikaCounterId = resolveYandexMetrikaId();
  const structuredData = {
    "@context":"https://schema.org",
    "@graph":[
      { "@type":"Organization", "@id":"https://7tool.ru/#organization", name:siteCompany.brandName, legalName:siteCompany.legalName, url:"https://7tool.ru/", email:siteContact.email, telephone:siteContact.phone, address:{ "@type":"PostalAddress", streetAddress:"Рябиновая улица, 63, стр. 4", addressLocality:"Москва", addressCountry:"RU" } },
      { "@type":"WebSite", "@id":"https://7tool.ru/#website", url:"https://7tool.ru/", name:siteCompany.brandName, publisher:{ "@id":"https://7tool.ru/#organization" }, inLanguage:"ru-RU" },
    ],
  };
  return <html lang="ru" data-scroll-behavior="smooth" data-document-navigation={forceDocumentNavigation ? "true" : undefined}><body><JsonLd data={structuredData} /><YandexMetrika counterId={metrikaCounterId} /><AttributionCapture counterId={metrikaCounterId} />{forceDocumentNavigation && <DocumentNavigationFallback />}<ConversionAnalytics counterId={metrikaCounterId} /><WebVitalsAnalytics /><ContactAnalytics /><RequestCartProvider><ComparisonProvider>{children}</ComparisonProvider></RequestCartProvider></body></html>;
}
