import Link from "next/link";

export function CategoryResultGuidance({ total, activeFilterCount, selectorHref, nextDecisionLabel }: {
  total: number;
  activeFilterCount: number;
  selectorHref: string;
  nextDecisionLabel?: string;
}) {
  if (activeFilterCount === 0 || total === 0) return null;

  const state = total === 1 ? "exact" : total <= 12 ? "shortlist" : "broad";
  const copy = state === "exact"
    ? {
        eyebrow:"Точное товарное семейство",
        title:"Можно выбирать исполнение прямо в карточке",
        body:"Все выбранные условия сохранены. Основные характеристики, цена и запрос КП доступны без возврата к категории.",
      }
    : state === "shortlist"
      ? {
          eyebrow:"Короткий список",
          title:`Осталось сравнить ${total} ${pluralizeModels(total)}`,
          body:"Сравните основные характеристики и откройте полные данные только у финальных кандидатов.",
        }
      : {
          eyebrow:"Выбор всё ещё широкий",
          title:"Добавьте один решающий параметр",
          body:nextDecisionLabel
            ? `Следующим лучше уточнить «${nextDecisionLabel}» — это быстрее просмотра десятков карточек.`
            : "Уточните ещё один рабочий параметр или передайте задачу инженеру.",
        };

  return <aside className={`feed-result-guidance feed-result-guidance--${state}`} aria-label="Следующий шаг подбора">
    <div><span>{copy.eyebrow}</span><b>{copy.title}</b><p>{copy.body}</p></div>
    {state === "broad" && <Link href={selectorHref}>{nextDecisionLabel ? `Уточнить: ${nextDecisionLabel}` : "Уточнить подбор"} →</Link>}
  </aside>;
}

function pluralizeModels(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return "моделей";
  if (mod10 === 1) return "модель";
  if (mod10 >= 2 && mod10 <= 4) return "модели";
  return "моделей";
}
