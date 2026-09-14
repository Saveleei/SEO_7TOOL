import type { Metadata } from "next";
import { PublicInfoContact, PublicInfoPage } from "../ui/PublicInfoPage";

export const metadata: Metadata = { title:"Гарантия и документы — 7TOOL", description:"Порядок подтверждения гарантии и комплекта документов на товары 7TOOL." };

export default function WarrantyPage() {
  return <PublicInfoPage currentPath="/warranty" eyebrow="До и после поставки" title="Гарантия и документы" intro="Гарантийный срок и комплект документов зависят от производителя и конкретного артикула. Мы подтверждаем их до оплаты, а не заменяем общей фразой на сайте." asideTitle="Условия относятся к товару" asideText="Попросите менеджера указать гарантию и перечень документов в коммерческом предложении.">
    <section className="section public-info-section"><div className="container"><div className="public-info-heading"><p className="eyebrow">До оплаты</p><h2>Что можно запросить по позиции</h2></div><div className="public-info-card-grid"><article><span>01</span><h3>Гарантийные условия</h3><p>Срок, начало действия и порядок обращения по выбранному оборудованию.</p></article><article><span>02</span><h3>Паспорт и руководство</h3><p>Наличие эксплуатационных документов проверяется по конкретному исполнению.</p></article><article><span>03</span><h3>Сертификаты</h3><p>Предоставляются, если применимы к товару и входят в доступный комплект документов.</p></article></div></div></section>
    <section className="section section-muted public-info-section"><div className="container public-info-two-column"><div><p className="eyebrow">Если возникла неисправность</p><h2>Сначала идентифицируем поставку</h2></div><div className="public-info-checklist"><p><b>Сообщите номер документа</b><span>Счёт, КП или иной документ помогает найти точную поставку.</span></p><p><b>Укажите модель и серийный номер</b><span>Приложите описание неисправности, фото или видео, если это возможно.</span></p><p><b>Получите порядок действий</b><span>Менеджер сверит условия производителя и сообщит дальнейший маршрут. Не отправляйте товар без согласования.</span></p></div></div></section>
    <PublicInfoContact title="Проверить гарантию или документы" text="Передайте модель, артикул или номер поставки. Мы не будем обещать одинаковые условия для разных производителей." placement="warranty_page" />
  </PublicInfoPage>;
}
