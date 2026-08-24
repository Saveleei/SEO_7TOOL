import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import { FavoritesProvider } from "@/lib/favorites";
import { ManagerFloating } from "@/components/ManagerFloating";
import { SiteJsonLd } from "@/components/SiteJsonLd";
import { absoluteUrl, SITE_URL } from "@/lib/site-config";
import { AttributionCapture } from "@/components/AttributionCapture";
import { YandexMetrika } from "@/components/YandexMetrika";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "7TOOL — промышленный инструмент для металлообработки",
    template: "%s — 7TOOL",
  },
  description:
    "Промышленный инструмент и оборудование для металлообработки: борфрезы, сверлильные станки, корончатые свёрла, кромкорезы, труборезы и сварочные каретки. Склады в Москве и Санкт-Петербурге.",
  applicationName: "7TOOL",
  authors: [{ name: "7TOOL" }],
  keywords: [
    "борфрезы", "магнитный сверлильный станок", "кромкорезы", "труборезы",
    "каретки сварочные", "промышленный инструмент", "Karnasch", "HEDEN", "LENZ",
    "для юридических лиц", "со склада",
  ],
  openGraph: {
    type: "website",
    siteName: "7TOOL",
    locale: "ru_RU",
    url: SITE_URL,
    title: "7TOOL — промышленный инструмент для металлообработки",
    description:
      "Борфрезы, магнитные станки, кромкорезы и труборезы для заводов и инженерных подразделений.",
    images: [{
      url: absoluteUrl("/og.png"),
      width: 1200,
      height: 630,
      alt: "7TOOL — промышленный инструмент и оборудование со склада",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "7TOOL — промышленный инструмент для металлообработки",
    description:
      "Борфрезы, магнитные станки, кромкорезы и труборезы. Склады в Москве и Санкт-Петербурге.",
    images: [absoluteUrl("/og.png")],
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#f59e0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className="antialiased bg-white text-steel-900">
        <SiteJsonLd />
        <AttributionCapture />
        <YandexMetrika />
        <CartProvider>
          <FavoritesProvider>
            {children}
            <ManagerFloating />
          </FavoritesProvider>
        </CartProvider>
      </body>
    </html>
  );
}
