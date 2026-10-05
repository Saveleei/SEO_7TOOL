import type { Metadata } from "next";
import Link from "next/link";
import { createPublicMetadata } from "../data/seo";
import { PublicInfoContact, PublicInfoPage } from "../ui/PublicInfoPage";

export const metadata: Metadata = createPublicMetadata({ title:"Гарантия, возврат и обмен оборудования — 7TOOL", description:"Порядок подтверждения гарантии и обращения по возврату или обмену оборудования, приобретённого у 7TOOL.", path:"/garantiya-i-vozvrat" });

export default function WarrantyAndReturnsPage() {
  return <PublicInfoPage currentPath="/garantiya-i-vozvrat" eyebrow="До и после поставки" title="Гарантия, возврат и обмен" intro="Гарантийные условия зависят от производителя и документов конкретной поставки. Условия возврата для организаций определяются договором, документами поставки и применимыми правилами." asideTitle="Сначала идентифицируем поставку" asideText="Подготовьте номер документа, модель, серийный номер и описание причины обращения.">
    <section className="section public-info-section"><div className="container"><div className="public-info-heading"><p className="eyebrow">Гарантия</p><h2>Условия подтверждаются по конкретному товару</h2></div><div className="public-info-card-grid"><article><span>01</span><h3>Сохраните документы</h3><p>Счёт, накладную, паспорт изделия и серийный номер.</p></article><article><span>02</span><h3>Опишите неисправность</h3><p>Приложите фото или видео, если это возможно. Не разбирайте оборудование до согласования диагностики.</p></article><article><span>03</span><h3>Получите маршрут</h3><p>Менеджер сверит условия производителя и сообщит дальнейшие действия.</p></article></div><Link className="button button-dark" href="/warranty">Гарантия и документы</Link></div></section>
    <section className="section section-muted public-info-section"><div className="container public-info-two-column"><div><p className="eyebrow">Возврат и обмен</p><h2>Не отправляйте товар без согласования</h2><p>Перед возвратом нужно связать обращение с поставкой и получить порядок действий. Возможность, сроки, комплектность и адрес передачи проверяются по документам конкретной сделки.</p></div><div className="public-info-checklist"><p><b>Номер поставки</b><span>Счёт, накладная или договор.</span></p><p><b>Состояние и комплектность</b><span>Описание, фото упаковки, товара и принадлежностей.</span></p><p><b>Причина обращения</b><span>Неисправность, несоответствие или иной проверяемый факт.</span></p></div></div></section>
    <PublicInfoContact title="Оформить обращение" text="Передайте номер поставки и описание ситуации. Менеджер подтвердит применимый порядок до отправки товара." placement="legacy_warranty_returns" />
  </PublicInfoPage>;
}
