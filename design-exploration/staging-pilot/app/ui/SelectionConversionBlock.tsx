import { ContactRequestDialog } from "./ContactRequestDialog";
import { maxUrl, telegramUrl } from "./ManagerContactCard";

export function SelectionConversionBlock({ categoryTitle }: { categoryTitle: string }) {
  return <section className="selection-conversion-card" aria-labelledby="selection-conversion-title">
    <div className="selection-conversion-copy">
      <span>Инженерная проверка</span>
      <h3 id="selection-conversion-title">Есть параметры? Отправьте их инженеру</h3>
      <p>Укажите известные размеры и материал. Если данных мало, опишите задачу — точный артикул не требуется.</p>
    </div>
    <div className="selection-conversion-actions">
      <ContactRequestDialog categoryTitle={categoryTitle} buttonLabel="Отправить параметры на проверку" />
      <div aria-label="Написать менеджеру в мессенджере">
        <a href={telegramUrl} target="_blank" rel="noopener noreferrer" aria-label="Написать менеджеру в Telegram"><i aria-hidden="true">T</i>Telegram</a>
        <a href={maxUrl} target="_blank" rel="noopener noreferrer" aria-label="Написать менеджеру в MAX"><i aria-hidden="true">M</i>MAX</a>
      </div>
    </div>
  </section>;
}
