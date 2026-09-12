import Link from "next/link";
import Image from "next/image";
import { canManager, type ManagerActor } from "../data/managerAccess";
import { HeaderSearch } from "./HeaderSearch";
import { ManagerSessionControl } from "./ManagerSessionControl";
import { RequestCartButton } from "./RequestCart";

export function PilotHeader({ managerMode = false, managerActor = null }: { managerMode?: boolean; managerActor?: ManagerActor | null }) {
  return (
    <>
      <div className="preview-banner"><span>Тестовый стенд</span><p>Локальное сохранение · внешняя отправка отключена · основной сайт не изменён</p></div>
      <header className="site-header">
        <div className="container header-row">
          <Link className="brand" href="/" aria-label="7TOOL — главная"><Image src="/brand/7tool-primary.svg" alt="7TOOL" width={142} height={44} priority /></Link>
          <Link className="catalog-button" href="/catalog"><i aria-hidden="true" />Каталог</Link>
          <HeaderSearch />
          <Link className="header-quick" href="/#quick-order"><span>?</span>Подбор по задаче</Link>
          <a className="header-email" href="mailto:info@7tool.ru"><span>Запросы и спецификации</span><b>info@7tool.ru</b></a>
          {managerMode ? <div className="manager-header-actions">{managerActor && canManager(managerActor, "settings:manage") && <Link className="manager-settings-link" href="/test/settings/quote">Настройки КП</Link>}{managerActor && <ManagerSessionControl actor={managerActor} />}</div> : <RequestCartButton />}
        </div>
      </header>
      {!managerMode && <nav className="mobile-action-bar" aria-label="Быстрые действия">
        <a href="mailto:info@7tool.ru?subject=Запрос%20в%207TOOL"><span>Написать</span><b>info@7tool.ru</b></a>
        <RequestCartButton compact />
      </nav>}
    </>
  );
}
