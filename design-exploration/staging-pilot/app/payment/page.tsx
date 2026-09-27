import type { Metadata } from "next";
import { getQuoteTemplateSettings } from "../data/quoteTemplateStore";
import { PublicInfoContact, PublicInfoPage } from "../ui/PublicInfoPage";
import { createPublicMetadata } from "../data/seo";

export const metadata: Metadata = createPublicMetadata({ title:"Оплата и счёт с НДС — 7TOOL", description:"Порядок согласования коммерческого предложения, выставления счёта с НДС и оплаты промышленного оборудования 7TOOL.", path:"/payment" });
export const dynamic = "force-dynamic";

export default async function PaymentPage() {
  const settings = await getQuoteTemplateSettings();
  const vatRate = settings.defaults.vatRate;
  return <PublicInfoPage currentPath="/payment" eyebrow="Условия закупки" title="Оплата по согласованному счёту" intro="Счёт формируется только после проверки состава заказа, цены, наличия и условий поставки. Онлайн-оплата на сайте не требуется." asideTitle="Сначала подтверждение, затем оплата" asideText="Цена в каталоге не заменяет коммерческое предложение по конкретному исполнению." heroVisual={<div className="public-document-preview"><header><span>Документы к оплате</span><b>КП → счёт</b></header><dl><div><dt>Состав</dt><dd>товар · исполнение · количество</dd></div><div><dt>НДС</dt><dd>{vatRate > 0 ? `${vatRate}%` : "Без НДС"}</dd></div><div><dt>Условия</dt><dd>цена · срок · поставка</dd></div></dl><p>Оплата — только по реквизитам согласованного документа.</p></div>}>
    <section className="section public-info-section"><div className="container"><div className="public-info-heading"><p className="eyebrow">Порядок оплаты</p><h2>Три контрольные точки до счёта</h2></div><ol className="public-info-steps"><li><span>01</span><div><h3>Состав заказа согласован</h3><p>В запросе зафиксированы конкретные товары, исполнения, количество и необходимая комплектация.</p></div></li><li><span>02</span><div><h3>Коммерческие условия подтверждены</h3><p>Менеджер проверяет цену, наличие, дату отгрузки, доставку и комплект документов.</p></div></li><li><span>03</span><div><h3>Выставлен счёт</h3><p>Оплата производится по реквизитам и условиям, указанным в счёте или договоре.</p></div></li></ol></div></section>
    <section className="section section-muted public-info-section"><div className="container public-commercial-summary"><div><span>НДС</span><b>{vatRate > 0 ? `${vatRate}%` : "Без НДС"}</b><p>Текущая ставка шаблона КП; итоговая сумма фиксируется в документе.</p></div><div><span>Способ</span><b>Безналичный расчёт</b><p>По выставленному счёту после согласования заказа.</p></div><div><span>Документы</span><b>КП и счёт</b><p>Реквизиты и условия относятся к конкретной редакции предложения.</p></div></div></section>
    <PublicInfoContact title="Запросить счёт или уточнить условия" text="Добавьте нужные позиции в КП или сообщите менеджеру задачу. Реквизиты покупателя можно передать после согласования состава заказа." placement="payment_page" />
  </PublicInfoPage>;
}
