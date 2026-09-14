import Link from "next/link";
import Image from "next/image";
import { canManager, type ManagerActor } from "../data/managerAccess";
import { getProductionCategoryGroups, pilotFeedCategorySlugs } from "../data/productionCategoryGroups";
import { HeaderCatalogMenu } from "./HeaderCatalogMenu";
import { HeaderContactMenu } from "./HeaderContactMenu";
import { HeaderSearch } from "./HeaderSearch";
import { ManagerSessionControl } from "./ManagerSessionControl";
import { RequestCartButton } from "./RequestCart";

export function PilotHeader({ managerMode = false, managerActor = null }: { managerMode?: boolean; managerActor?: ManagerActor | null }) {
  const categoryGroups = managerMode ? [] : getProductionCategoryGroups(pilotFeedCategorySlugs);
  return (
    <>
      <div className="preview-banner"><span>Тестовый стенд</span><p>Локальное сохранение · внешняя отправка отключена · основной сайт не изменён</p></div>
      <header className="site-header">
        <div className="container header-row">
          <Link className="brand" href="/" aria-label="7TOOL — главная"><Image src="/brand/7tool-primary.svg" alt="7TOOL" width={142} height={44} priority /></Link>
          {managerMode ? <div className="manager-header-actions"><nav className="manager-workspace-nav" aria-label="Рабочее место"><Link href="/test/requests">Заявки</Link>{managerActor && canManager(managerActor, "catalog:audit") && <Link href="/test/catalog-quality">Качество каталога</Link>}{managerActor && canManager(managerActor, "delivery:prepare") && <Link href="/test/delivery">Очередь КП</Link>}{managerActor && canManager(managerActor, "settings:manage") && <><Link href="/test/settings/homepage">Главная</Link><Link href="/test/settings/trust">Доверие</Link><Link href="/test/settings/shipping">Отгрузка</Link><Link href="/test/settings/quote">Настройки КП</Link></>}</nav>{managerActor && <ManagerSessionControl actor={managerActor} />}</div> : <><HeaderCatalogMenu groups={categoryGroups} /><HeaderSearch /><Link className="header-quick" href="/#production-categories"><span>?</span>Выбрать по задаче</Link><Link className="header-info-link" href="/company">Компания</Link><HeaderContactMenu placement="desktop_header" /><RequestCartButton /></>}
        </div>
      </header>
      {!managerMode && <nav className="mobile-action-bar" aria-label="Быстрые действия">
        <HeaderContactMenu compact placement="mobile_action_bar" />
        <RequestCartButton compact />
      </nav>}
    </>
  );
}
