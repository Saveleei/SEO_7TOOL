import type { Metadata } from "next";
import "./globals.css";
import { ContactAnalytics } from "./ui/ContactAnalytics";
import { DocumentNavigationFallback } from "./ui/DocumentNavigationFallback";
import { RequestCartProvider } from "./ui/RequestCart";

export const metadata: Metadata = {
  metadataBase: new URL("https://7tool.ru"),
  title: "7TOOL — тестовый каталог промышленного оборудования",
  description: "Закрытый прототип нового каталога 7TOOL: быстрый поиск, инженерный подбор и запрос КП.",
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: "7TOOL — тестовый каталог",
    description: "Прототип короткого пути от задачи до товара и коммерческого предложения.",
    images: [{ url: "/og.png", width: 1734, height: 907, alt: "7TOOL — оборудование для металлообработки" }],
  },
  twitter: { card: "summary_large_image", title: "7TOOL — тестовый каталог", description: "Прототип короткого пути от задачи до товара и коммерческого предложения.", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const forceDocumentNavigation = process.env.FORCE_DOCUMENT_NAVIGATION !== "0";
  return <html lang="ru" data-scroll-behavior="smooth" data-document-navigation={forceDocumentNavigation ? "true" : undefined}><body>{forceDocumentNavigation && <DocumentNavigationFallback />}<ContactAnalytics /><RequestCartProvider>{children}</RequestCartProvider></body></html>;
}
