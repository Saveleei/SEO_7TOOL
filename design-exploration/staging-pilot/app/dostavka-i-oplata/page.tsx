import type { Metadata } from "next";
import Link from "next/link";
import { createPublicMetadata } from "../data/seo";
import { PublicInfoContact, PublicInfoPage } from "../ui/PublicInfoPage";

export const metadata: Metadata = createPublicMetadata({ title:"Доставка и оплата промышленного оборудования — 7TOOL", description:"Общий порядок оплаты, подтверждения наличия, отгрузки и доставки оборудования 7TOOL по России.", path:"/dostavka-i-oplata" });

export default function DeliveryAndPaymentPage() {
  return <PublicInfoPage currentPath="/dostavka-i-oplata" eyebrow="Условия поставки" title="Доставка и оплата" intro="Условия конкретной поставки фиксируются в счёте или коммерческом предложении после проверки исполнения, наличия и параметров заказа." asideTitle="Один документ — точные условия" asideText="До оплаты менеджер подтверждает состав, цену, НДС, дату отгрузки и способ доставки.">
    <section className="section public-info-section"><div className="container public-info-two-column"><div><p className="eyebrow">Оплата</p><h2>После согласования состава заказа</h2><p>Работаем с организациями по безналичному расчёту. Окончательные реквизиты, ставка НДС, срок оплаты и состав поставки указываются в согласованном счёте.</p><Link className="button button-dark" href="/payment">Подробно об оплате</Link></div><div className="public-info-checklist"><p><b>Сначала проверка</b><span>Артикул, количество, цена, наличие и комплектация.</span></p><p><b>Затем документы</b><span>Коммерческое предложение и счёт относятся к конкретной редакции заказа.</span></p></div></div></section>
    <section className="section section-muted public-info-section"><div className="container public-info-two-column"><div><p className="eyebrow">Доставка</p><h2>Срок и стоимость подтверждаются до оплаты</h2><p>Поставка возможна по России. Город, способ передачи, стоимость и дата отгрузки согласуются с покупателем и фиксируются в документах.</p><Link className="button button-dark" href="/delivery">Подробно о доставке</Link></div><div className="public-info-checklist"><p><b>Самовывоз</b><span>Только после подтверждения готовности заказа.</span></p><p><b>Транспортная компания</b><span>После согласования направления и условий перевозки.</span></p><p><b>Фактический остаток</b><span>Обещание даты относится к выбранному исполнению.</span></p></div></div></section>
    <PublicInfoContact title="Согласовать оплату и доставку" text="Сообщите товар, количество и город. Менеджер подготовит единые подтверждённые условия поставки." placement="legacy_delivery_payment" />
  </PublicInfoPage>;
}
