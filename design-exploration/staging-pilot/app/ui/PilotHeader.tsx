import Link from "next/link";
import Image from "next/image";

export function PilotHeader() {
  return (
    <>
      <div className="preview-banner"><span>Тестовый стенд</span><p>Безопасный прототип · формы не отправляются · основной сайт не изменён</p></div>
      <header className="site-header">
        <div className="container header-row">
          <Link className="brand" href="/" aria-label="7TOOL — главная"><Image src="/brand/7tool-primary.svg" alt="7TOOL" width={142} height={44} priority /></Link>
          <Link className="catalog-button" href="/catalog"><i aria-hidden="true" />Каталог</Link>
          <Link className="header-search" href="/#search"><span aria-hidden="true">⌕</span><span>Найти модель, артикул или оборудование</span><b>Поиск</b></Link>
          <a className="header-email" href="mailto:info@7tool.ru"><span>Запросы и спецификации</span><b>info@7tool.ru</b></a>
          <Link className="header-quote" href="/product/lenz-steyr-35#request">Получить КП</Link>
        </div>
      </header>
      <nav className="mobile-action-bar" aria-label="Быстрые действия">
        <a href="mailto:info@7tool.ru?subject=Запрос%20в%207TOOL"><span>Написать</span><b>info@7tool.ru</b></a>
        <Link href="/product/lenz-steyr-35#request">Получить КП</Link>
      </nav>
    </>
  );
}
