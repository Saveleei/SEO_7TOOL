import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "7TOOL — тестовый каталог промышленного оборудования",
  description: "Закрытый прототип нового каталога 7TOOL: быстрый поиск, инженерный подбор и запрос КП.",
  robots: { index: false, follow: false, nocache: true },
  openGraph: {
    title: "7TOOL — тестовый каталог",
    description: "Прототип короткого пути от задачи до товара и коммерческого предложения.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" data-scroll-behavior="smooth"><body>{children}</body></html>;
}
