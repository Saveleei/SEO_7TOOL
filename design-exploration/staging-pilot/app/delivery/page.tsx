import type { Metadata } from "next";
import { getShippingSettings } from "../data/shippingSettingsStore";
import { PublicInfoContact, PublicInfoPage } from "../ui/PublicInfoPage";
import { createPublicMetadata } from "../data/seo";

export const metadata: Metadata = createPublicMetadata({ title:"Доставка промышленного оборудования по России — 7TOOL", description:"Как 7TOOL подтверждает наличие, дату отгрузки и согласует доставку промышленного оборудования по России.", path:"/delivery" });
export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const shipping = await getShippingSettings();
  const cutoff = `${String(shipping.cutoffHour).padStart(2, "0")}:00 МСК`;
  return <PublicInfoPage currentPath="/delivery" eyebrow="Поставка по России" title="Доставка и отгрузка" intro="Город, способ, стоимость и дата передачи товара согласуются до оплаты и фиксируются в коммерческом предложении." asideTitle="Наличие не равно обещанию даты" asideText="Срок относится к выбранному исполнению и подтверждается по актуальному остатку." heroVisual={<div className="public-delivery-preview"><span>Расчёт поставки</span><ol><li><b>1</b><div>Исполнение<small>артикул и количество</small></div></li><li><b>2</b><div>Направление<small>город и способ получения</small></div></li><li><b>3</b><div>Подтверждение<small>{shipping.todayEnabled ? `до ${cutoff}` : "дата в КП"}</small></div></li></ol><p>{shipping.todayEnabled ? "Обещание зависит от остатка и рабочего дня." : "Автоматическое обещание даты отключено."}</p></div>}>
    <section className="section public-info-section"><div className="container"><div className="public-info-heading"><p className="eyebrow">Как формируется срок</p><h2>От товара до согласованной поставки</h2></div><ol className="public-info-steps"><li><span>01</span><div><h3>Проверяем исполнение</h3><p>Уточняем артикул, количество и фактический статус поставки.</p></div></li><li><span>02</span><div><h3>Согласуем логистику</h3><p>Фиксируем город, способ передачи, стоимость и необходимые документы.</p></div></li><li><span>03</span><div><h3>Указываем дату в КП</h3><p>Покупатель получает конкретные условия, относящиеся к текущему предложению.</p></div></li></ol></div></section>
    <section className="section section-muted public-info-section"><div className="container public-shipping-rule"><div><p className="eyebrow">Статус на сайте</p><h2>Когда появляется «Отгрузка сегодня»</h2><p>{shipping.todayEnabled ? <>Только если у выбранного исполнения подтверждён положительный остаток, текущий день является рабочим и запрос сделан до <b>{cutoff}</b>. После границы показывается следующий рабочий день.</> : <>Обещание отгрузки в день заказа временно отключено. Дату подтвердит менеджер в коммерческом предложении.</>}</p></div><aside><b>Не обещаем автоматически</b><ul><li>доставку до конкретного города;</li><li>стоимость перевозки;</li><li>отгрузку для частичного или неизвестного остатка.</li></ul></aside></div></section>
    <PublicInfoContact title="Рассчитать поставку в ваш город" text="Сообщите город, количество и желаемый способ получения. Менеджер добавит подтверждённые условия в КП." placement="delivery_page" />
  </PublicInfoPage>;
}
