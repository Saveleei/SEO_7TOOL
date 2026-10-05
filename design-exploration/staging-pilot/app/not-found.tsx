import type { Metadata } from "next";
import Link from "next/link";
import { PilotFooter } from "./ui/PilotFooter";
import { PilotHeader } from "./ui/PilotHeader";

export const metadata: Metadata = {
  title:"Страница не найдена — 7TOOL",
  description:"Запрошенная страница не найдена. Перейдите в каталог 7TOOL или воспользуйтесь поиском.",
  robots:{ index:false, follow:true },
};

export default function NotFoundPage() {
  return <div className="site-shell"><PilotHeader /><main className="inner-page"><section className="page-hero"><div className="container"><p className="eyebrow">Ошибка 404</p><h1>Страница не найдена</h1><p>Адрес мог измениться или страница больше недоступна. Каталог и поиск помогут найти нужное оборудование или подтверждённую замену.</p><div className="page-actions"><Link className="button button-primary" href="/catalog">Перейти в каталог</Link><Link className="button button-secondary" href="/search">Найти товар</Link></div></div></section></main><PilotFooter /></div>;
}
