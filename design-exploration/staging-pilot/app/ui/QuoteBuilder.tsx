"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { QuoteDraft, QuoteDraftItem } from "../data/quoteDraftStore";

type EditableItem = Omit<QuoteDraftItem, "lineTotalRub">;

export function QuoteBuilder({ initial }: { initial: QuoteDraft }) {
  const router = useRouter();
  const [items, setItems] = useState<EditableItem[]>(initial.items.map((item) => ({ ...item })));
  const [validityDays, setValidityDays] = useState(initial.validityDays);
  const legacyVatRate = initial.vatRate === 20;
  const [vatRate, setVatRate] = useState(legacyVatRate ? 22 : initial.vatRate);
  const [paymentTerms, setPaymentTerms] = useState(initial.paymentTerms);
  const [deliveryTerms, setDeliveryTerms] = useState(initial.deliveryTerms);
  const [managerComment, setManagerComment] = useState(initial.managerComment);
  const [sender, setSender] = useState(initial.sender);
  const [stampAssetId, setStampAssetId] = useState(initial.stampAssetId);
  const [stampUrl, setStampUrl] = useState(initial.stampAssetId ? stampAssetUrl(initial.requestId, initial.stampAssetId) : "");
  const [includeStamp, setIncludeStamp] = useState(initial.includeStamp);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [revision, setRevision] = useState(initial.revision);
  const [status, setStatus] = useState(initial.status);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const totals = useMemo(() => calculateTotals(items, vatRate), [items, vatRate]);

  function updateItem(index: number, patch: Partial<EditableItem>) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function uploadStamp(file: File | undefined) {
    if (!file) return;
    setUploadingStamp(true);
    setMessage("");
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/quote-requests/${encodeURIComponent(initial.requestId)}/quote-assets`, { method:"POST", body:form });
      const result = await response.json() as { ok?: boolean; message?: string; assetId?: string; url?: string };
      if (!response.ok || !result.ok || !result.assetId || !result.url) throw new Error(result.message || "Файл не загружен.");
      setStampAssetId(result.assetId);
      setStampUrl(result.url);
      setIncludeStamp(true);
      setMessage("Файл загружен локально. Сохраните редакцию КП.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Файл не загружен.");
    } finally {
      setUploadingStamp(false);
    }
  }

  async function save(nextStatus: "draft" | "ready") {
    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/quote-requests/${encodeURIComponent(initial.requestId)}/quote-draft`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ idempotencyKey:crypto.randomUUID(), status:nextStatus, validityDays, vatRate, paymentTerms, deliveryTerms, managerComment, sender, stampAssetId, includeStamp, items }),
      });
      const result = await response.json() as { ok?: boolean; message?: string; revision?: number; status?: "draft" | "ready" };
      if (!response.ok || !result.ok) throw new Error(result.message || "Черновик не сохранён.");
      setRevision(result.revision || revision);
      setStatus(result.status || nextStatus);
      setMessage(nextStatus === "ready" ? "КП готово к внутреннему согласованию." : "Черновик сохранён локально.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Черновик не сохранён.");
    } finally {
      setPending(false);
    }
  }

  return <div className="quote-builder-layout">
    <div className="quote-builder-main">
      <section className="quote-builder-card"><header><div><span>01</span><h2>Позиции и условия поставки</h2></div><p>Цена из запроса — отправная точка. Наличие и срок менеджер подтверждает вручную.</p></header><div className="quote-editor-items">
        {items.map((item, index) => <article key={item.id}><div className="quote-editor-product">{item.productPresentation?.imageUrl && <Image src={item.productPresentation.imageUrl} alt={item.productPresentation.imageAlt} width={132} height={132} sizes="132px" />}<div><small>{item.article || "Без артикула"}</small><h3>{item.title}</h3>{item.productPresentation ? <span className="quote-verified-variant">✓ Точное исполнение проверено по фиду</span> : <p className="quote-product-unverified">Фото и характеристики не найдены для точного исполнения — добавлять их в КП автоматически небезопасно.</p>}</div>{item.productPresentation && <dl>{item.productPresentation.keySpecs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl>}</div><div className="quote-editor-fields">
          <label><span>Количество</span><input type="number" min={1} max={10000} value={item.quantity} onChange={(event) => updateItem(index, { quantity:Number(event.target.value) })} /></label>
          <label><span>Цена за единицу, ₽</span><input type="number" min={0} step="0.01" value={item.unitPriceRub} onChange={(event) => updateItem(index, { unitPriceRub:Number(event.target.value) })} /></label>
          <label><span>Скидка, %</span><input type="number" min={0} max={90} step="0.1" value={item.discountPercent} onChange={(event) => updateItem(index, { discountPercent:Number(event.target.value) })} /></label>
          <label><span>Статус поставки</span><select value={item.supplyStatus} onChange={(event) => updateItem(index, { supplyStatus:event.target.value as EditableItem["supplyStatus"] })}><option value="unknown">Требует подтверждения</option><option value="confirmed">В наличии подтверждено</option><option value="supplier_confirmed">Подтверждено поставщиком</option><option value="to_order">Под заказ</option></select></label>
          <label className="wide"><span>Подтверждённый срок</span><input value={item.shipmentText} maxLength={120} onChange={(event) => updateItem(index, { shipmentText:event.target.value })} placeholder="Например: отгрузка 15 сентября" /></label>
          <div className="quote-editor-line-total"><span>Сумма строки</span><b>{rub(lineTotal(item))}</b></div>
        </div></article>)}
      </div></section>
      <section className="quote-builder-card"><header><div><span>02</span><h2>Коммерческие условия</h2></div><p>Не публикуйте условия, которые не подтверждены компанией или поставщиком.</p></header><div className="quote-commercial-fields">
        <label><span>Условия оплаты</span><textarea rows={3} maxLength={300} value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} placeholder="Заполните после согласования условий" /></label>
        <label><span>Доставка и передача товара</span><textarea rows={3} maxLength={300} value={deliveryTerms} onChange={(event) => setDeliveryTerms(event.target.value)} placeholder="Способ, город, стоимость или условия расчёта" /></label>
        <label><span>Срок действия КП, дней</span><input type="number" min={1} max={90} value={validityDays} onChange={(event) => setValidityDays(Number(event.target.value))} /></label>
        <label><span>Ставка НДС</span><select value={vatRate} onChange={(event) => setVatRate(Number(event.target.value))}><option value={22}>22%, включён — основная ставка</option><option value={10}>10%, включён — пониженная ставка</option><option value={0}>Без НДС</option></select>{legacyVatRate && <small>В сохранённой редакции было 20%. Новая редакция будет рассчитана по ставке 22%.</small>}</label>
        <label className="wide"><span>Комментарий менеджера в КП</span><textarea rows={4} maxLength={1000} value={managerComment} onChange={(event) => setManagerComment(event.target.value)} placeholder="Например: аналог возможен после проверки технической применимости." /></label>
      </div></section>
      <section className="quote-builder-card"><header><div><span>03</span><h2>Отправитель и подпись</h2></div><p>Данные сохраняются в конкретной редакции. Используйте только утверждённое компанией изображение.</p></header><div className="quote-sender-fields">
        <label><span>ФИО отправителя</span><input value={sender.name} maxLength={100} onChange={(event) => setSender((current) => ({ ...current, name:event.target.value }))} /></label>
        <label><span>Должность</span><input value={sender.role} maxLength={120} onChange={(event) => setSender((current) => ({ ...current, role:event.target.value }))} /></label>
        <label><span>Телефон</span><input type="tel" value={sender.phone} maxLength={50} onChange={(event) => setSender((current) => ({ ...current, phone:event.target.value }))} /></label>
        <label><span>Email</span><input type="email" value={sender.email} maxLength={160} onChange={(event) => setSender((current) => ({ ...current, email:event.target.value }))} /></label>
        <div className="quote-stamp-control"><div>{stampUrl ? <Image src={stampUrl} alt="Предпросмотр печати и подписи" width={220} height={110} unoptimized /> : <span className="quote-stamp-placeholder">Файл ещё не загружен</span>}</div><div><b>Печать и подпись</b><p>PNG, JPG или WebP до 1,5 МБ. SVG и документы не принимаются.</p><label className="quote-stamp-upload"><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingStamp} onChange={(event) => void uploadStamp(event.target.files?.[0])} /><span>{uploadingStamp ? "Загружаем…" : stampAssetId ? "Заменить файл" : "Загрузить файл"}</span></label>{stampAssetId && <label className="quote-stamp-toggle"><input type="checkbox" checked={includeStamp} onChange={(event) => setIncludeStamp(event.target.checked)} /><span>Показывать в этом КП</span></label>}</div></div>
      </div></section>
    </div>
    <aside className="quote-builder-summary"><div className="quote-summary-head"><span>Коммерческое предложение</span><h2>{initial.id}</h2><p>Редакция {revision || "не сохранена"} · {status === "ready" ? "готово к согласованию" : "черновик"}</p></div><dl><div><dt>До скидки</dt><dd>{rub(totals.beforeDiscount)}</dd></div><div><dt>Скидка</dt><dd>− {rub(totals.discount)}</dd></div><div className="total"><dt>Итого</dt><dd>{rub(totals.total)}</dd></div><div><dt>{vatRate ? `В том числе НДС ${vatRate}%` : "НДС"}</dt><dd>{vatRate ? rub(totals.vatIncluded) : "Без НДС"}</dd></div></dl><div className="quote-builder-actions"><button type="button" disabled={pending} onClick={() => save("draft")}>{pending ? "Сохраняем…" : "Сохранить черновик"}</button><button className="ready" type="button" disabled={pending} onClick={() => save("ready")}>Готово к согласованию</button>{revision > 0 ? <a href={`/test/requests/${initial.requestId}/quote?mode=preview`}>Предпросмотр и печать</a> : <small>Сохраните черновик, чтобы открыть предпросмотр.</small>}</div><div className="quote-builder-feedback" aria-live="polite">{error ? <p className="error">{error}</p> : message ? <p className="success">{message}</p> : null}</div><small className="quote-local-note">Сохранение только локальное. Клиенту ничего не отправляется.</small></aside>
  </div>;
}

function lineTotal(item: EditableItem) {
  return Math.round(item.quantity * item.unitPriceRub * (1 - item.discountPercent / 100) * 100) / 100;
}

function calculateTotals(items: EditableItem[], vatRate: number) {
  const beforeDiscount = items.reduce((sum, item) => sum + item.quantity * item.unitPriceRub, 0);
  const total = items.reduce((sum, item) => sum + lineTotal(item), 0);
  return { beforeDiscount, total, discount:beforeDiscount - total, vatIncluded:vatRate ? total * vatRate / (100 + vatRate) : 0 };
}

function rub(value: number) {
  return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits:value % 1 ? 2 : 0, maximumFractionDigits:2 }).format(value)} ₽`;
}

function stampAssetUrl(requestId: string, assetId: string) {
  return `/api/quote-requests/${encodeURIComponent(requestId)}/quote-assets/${encodeURIComponent(assetId)}`;
}
