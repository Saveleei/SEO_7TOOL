import Link from "next/link";
import Image from "next/image";

export function PilotHeader() {
  return (
    <>
      <div className="preview-banner"><span>Тестовый стенд</span><p>Формы не отправляются · основной сайт не изменён</p></div>
      <header className="site-header">
        <div className="container header-row">
          <Link className="brand" href="/" aria-label="7TOOL — главная"><Image src="/brand/7tool-primary.svg" alt="7TOOL" width={142} height={44} priority /></Link>
          <Link className="catalog-button" href="/catalog"><i aria-hidden="true" />Каталог</Link>
          <div className="header-search"><span aria-hidden="true">⌕</span><span>Модель, артикул или задача</span></div>
          <a className="header-email" href="mailto:info@7tool.ru"><span>Запросы на почту</span><b>info@7tool.ru</b></a>
          <Link className="header-quote" href="/product/lenz-steyr-35#request">Получить КП</Link>
        </div>
      </header>
    </>
  );
}
