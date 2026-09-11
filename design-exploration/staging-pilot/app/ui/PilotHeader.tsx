import Link from "next/link";
import Image from "next/image";
import { HeaderSearch } from "./HeaderSearch";
import { RequestCartButton } from "./RequestCart";

export function PilotHeader() {
  return (
    <>
      <div className="preview-banner"><span>Тестовый стенд</span><p>Безопасный прототип · формы не отправляются · основной сайт не изменён</p></div>
      <header className="site-header">
        <div className="container header-row">
          <Link className="brand" href="/" aria-label="7TOOL — главная"><Image src="/brand/7tool-primary.svg" alt="7TOOL" width={142} height={44} priority /></Link>
          <Link className="catalog-button" href="/catalog"><i aria-hidden="true" />Каталог</Link>
          <HeaderSearch />
          <Link className="header-quick" href="/#quick-order"><span>?</span>Подбор по задаче</Link>
          <a className="header-email" href="mailto:info@7tool.ru"><span>Запросы и спецификации</span><b>info@7tool.ru</b></a>
          <RequestCartButton />
        </div>
      </header>
      <nav className="mobile-action-bar" aria-label="Быстрые действия">
        <a href="mailto:info@7tool.ru?subject=Запрос%20в%207TOOL"><span>Написать</span><b>info@7tool.ru</b></a>
        <RequestCartButton compact />
      </nav>
    </>
  );
}
