"use client";

import Image from "next/image";
import { useState } from "react";
import type { QuoteTemplateSender, QuoteTemplateSettings } from "../data/quoteTemplateStore";

export function QuoteTemplateSettingsForm({ initial }: { initial: QuoteTemplateSettings }) {
  const [settings, setSettings] = useState(initial);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const defaultSender = settings.senders.find((sender) => sender.id === settings.defaultSenderId) ?? settings.senders[0];

  function updateSender(index: number, patch: Partial<QuoteTemplateSender>) {
    setSettings((current) => ({ ...current, senders:current.senders.map((sender, senderIndex) => senderIndex === index ? { ...sender, ...patch } : sender) }));
  }

  function addSender() {
    if (settings.senders.length >= 8) return;
    const id = `sender-${crypto.randomUUID().slice(0, 8)}`;
    setSettings((current) => ({ ...current, senders:[...current.senders, { id, name:"", role:"", phone:current.seller.phone, email:current.seller.email }] }));
  }

  function removeSender(id: string) {
    setSettings((current) => {
      if (current.senders.length <= 1) return current;
      const senders = current.senders.filter((sender) => sender.id !== id);
      return { ...current, senders, defaultSenderId:current.defaultSenderId === id ? senders[0].id : current.defaultSenderId };
    });
  }

  async function uploadStamp(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setMessage("");
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/quote-settings/stamp", { method:"POST", body:form });
      const result = await response.json() as { ok?: boolean; message?: string; assetId?: string };
      if (!response.ok || !result.ok || !result.assetId) throw new Error(result.message || "Файл не загружен.");
      setSettings((current) => ({ ...current, stampAssetId:result.assetId || "" }));
      setMessage("Печать загружена локально. Сохраните настройки, чтобы использовать её в новых КП.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Файл не загружен.");
    } finally {
      setUploading(false);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/quote-settings", { method:"PUT", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(settings) });
      const result = await response.json() as { ok?: boolean; message?: string; settings?: QuoteTemplateSettings };
      if (!response.ok || !result.ok || !result.settings) throw new Error(result.message || "Настройки не сохранены.");
      setSettings(result.settings);
      setMessage(`Настройки сохранены. Версия ${result.settings.revision}. Они применятся к новым КП.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Настройки не сохранены.");
    } finally {
      setPending(false);
    }
  }

  return <form className="quote-settings-layout" onSubmit={save}>
    <div className="quote-settings-main">
      <section className="quote-settings-card"><header><span>01</span><div><h2>Реквизиты продавца</h2><p>Попадут в новые редакции КП. Пустые ИНН и банковские поля не выводятся.</p></div></header><div className="quote-settings-grid">
        <Field label="Торговое наименование" value={settings.seller.brandName} maxLength={80} onChange={(brandName) => setSettings((current) => ({ ...current, seller:{ ...current.seller, brandName } }))} />
        <Field label="Юридическое наименование" value={settings.seller.legalName} maxLength={180} onChange={(legalName) => setSettings((current) => ({ ...current, seller:{ ...current.seller, legalName } }))} />
        <Field label="ИНН" value={settings.seller.inn} inputMode="numeric" maxLength={12} onChange={(inn) => setSettings((current) => ({ ...current, seller:{ ...current.seller, inn } }))} />
        <Field label="КПП" value={settings.seller.kpp} inputMode="numeric" maxLength={9} onChange={(kpp) => setSettings((current) => ({ ...current, seller:{ ...current.seller, kpp } }))} />
        <Field label="ОГРН / ОГРНИП" value={settings.seller.ogrn} inputMode="numeric" maxLength={15} onChange={(ogrn) => setSettings((current) => ({ ...current, seller:{ ...current.seller, ogrn } }))} />
        <Field label="Телефон" value={settings.seller.phone} type="tel" maxLength={50} onChange={(phone) => setSettings((current) => ({ ...current, seller:{ ...current.seller, phone } }))} />
        <Field label="Email" value={settings.seller.email} type="email" maxLength={160} onChange={(email) => setSettings((current) => ({ ...current, seller:{ ...current.seller, email } }))} />
        <Field label="Сайт" value={settings.seller.website} type="url" maxLength={160} onChange={(website) => setSettings((current) => ({ ...current, seller:{ ...current.seller, website } }))} />
        <label className="wide"><span>Юридический адрес</span><textarea rows={2} maxLength={240} value={settings.seller.legalAddress} onChange={(event) => setSettings((current) => ({ ...current, seller:{ ...current.seller, legalAddress:event.target.value } }))} /></label>
      </div></section>

      <section className="quote-settings-card"><header><span>02</span><div><h2>Банковские реквизиты</h2><p>Заполняются комплектом и выводятся только при включённой настройке.</p></div></header><div className="quote-settings-grid">
        <Field className="wide" label="Наименование банка" value={settings.seller.bankName} maxLength={180} onChange={(bankName) => setSettings((current) => ({ ...current, seller:{ ...current.seller, bankName } }))} />
        <Field label="БИК" value={settings.seller.bik} inputMode="numeric" maxLength={9} onChange={(bik) => setSettings((current) => ({ ...current, seller:{ ...current.seller, bik } }))} />
        <Field label="Расчётный счёт" value={settings.seller.checkingAccount} inputMode="numeric" maxLength={20} onChange={(checkingAccount) => setSettings((current) => ({ ...current, seller:{ ...current.seller, checkingAccount } }))} />
        <Field label="Корреспондентский счёт" value={settings.seller.correspondentAccount} inputMode="numeric" maxLength={20} onChange={(correspondentAccount) => setSettings((current) => ({ ...current, seller:{ ...current.seller, correspondentAccount } }))} />
        <label className="quote-settings-check wide"><input type="checkbox" checked={settings.document.showBankDetails} onChange={(event) => setSettings((current) => ({ ...current, document:{ ...current.document, showBankDetails:event.target.checked } }))} /><span><b>Показывать реквизиты в КП</b><small>Только если банк, БИК и оба счёта заполнены полностью.</small></span></label>
      </div></section>

      <section className="quote-settings-card"><header><span>03</span><div><h2>Подписанты</h2><p>Менеджер выбирает сотрудника из списка и при необходимости корректирует данные только для своей редакции.</p></div><button type="button" onClick={addSender} disabled={settings.senders.length >= 8}>Добавить</button></header><div className="quote-settings-senders">
        {settings.senders.map((sender, index) => <article key={sender.id}><div className="quote-sender-heading"><label><input type="radio" name="default-sender" checked={settings.defaultSenderId === sender.id} onChange={() => setSettings((current) => ({ ...current, defaultSenderId:sender.id }))} /><span>По умолчанию</span></label><button type="button" onClick={() => removeSender(sender.id)} disabled={settings.senders.length <= 1}>Удалить</button></div><div className="quote-settings-grid">
          <Field label="ФИО" value={sender.name} maxLength={100} onChange={(name) => updateSender(index, { name })} />
          <Field label="Должность" value={sender.role} maxLength={120} onChange={(role) => updateSender(index, { role })} />
          <Field label="Телефон" value={sender.phone} type="tel" maxLength={50} onChange={(phone) => updateSender(index, { phone })} />
          <Field label="Email" value={sender.email} type="email" maxLength={160} onChange={(email) => updateSender(index, { email })} />
        </div></article>)}
      </div></section>

      <section className="quote-settings-card"><header><span>04</span><div><h2>Шаблон документа</h2><p>Это стартовые значения: менеджер подтверждает коммерческие условия в каждом КП.</p></div></header><div className="quote-settings-grid">
        <Field label="Название документа" value={settings.document.title} maxLength={80} onChange={(title) => setSettings((current) => ({ ...current, document:{ ...current.document, title } }))} />
        <Field label="Заголовок над товарами" value={settings.document.introText} maxLength={500} onChange={(introText) => setSettings((current) => ({ ...current, document:{ ...current.document, introText } }))} />
        <label><span>Условия оплаты по умолчанию</span><textarea rows={3} maxLength={300} value={settings.defaults.paymentTerms} onChange={(event) => setSettings((current) => ({ ...current, defaults:{ ...current.defaults, paymentTerms:event.target.value } }))} /></label>
        <label><span>Поставка по умолчанию</span><textarea rows={3} maxLength={300} value={settings.defaults.deliveryTerms} onChange={(event) => setSettings((current) => ({ ...current, defaults:{ ...current.defaults, deliveryTerms:event.target.value } }))} /></label>
        <Field label="Срок действия, дней" type="number" min={1} max={90} value={String(settings.defaults.validityDays)} onChange={(value) => setSettings((current) => ({ ...current, defaults:{ ...current.defaults, validityDays:Number(value) } }))} />
        <label><span>Ставка НДС</span><select value={settings.defaults.vatRate} onChange={(event) => setSettings((current) => ({ ...current, defaults:{ ...current.defaults, vatRate:Number(event.target.value) } }))}><option value={22}>22%, включён</option><option value={10}>10%, включён</option><option value={0}>Без НДС</option></select></label>
        <label className="wide"><span>Примечание внизу документа</span><textarea rows={2} maxLength={300} value={settings.document.footerText} onChange={(event) => setSettings((current) => ({ ...current, document:{ ...current.document, footerText:event.target.value } }))} /></label>
      </div></section>

      <section className="quote-settings-card"><header><span>05</span><div><h2>Печать и подпись</h2><p>Один утверждённый PNG, JPG или WebP до 1,5 МБ. PDF принимает PNG/JPG; WebP остаётся только в веб-предпросмотре.</p></div></header><div className="quote-template-stamp">
        <div>{settings.stampAssetId ? <Image src={`/api/quote-settings/stamp/${settings.stampAssetId}`} alt="Сохранённая печать и подпись" width={260} height={130} unoptimized /> : <span>Файл не загружен</span>}</div><div><label className="quote-stamp-upload"><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={(event) => void uploadStamp(event.target.files?.[0])} /><span>{uploading ? "Загружаем…" : settings.stampAssetId ? "Заменить файл" : "Загрузить файл"}</span></label><label className="quote-settings-check"><input type="checkbox" checked={settings.includeStampByDefault} onChange={(event) => setSettings((current) => ({ ...current, includeStampByDefault:event.target.checked }))} /><span><b>Добавлять в новые КП</b><small>Менеджер сможет отключить печать в конкретной редакции.</small></span></label></div>
      </div></section>
    </div>

    <aside className="quote-settings-summary"><span>Предпросмотр настроек</span><h2>{settings.seller.brandName}</h2><p>{settings.seller.legalName}</p><dl><div><dt>Подписант</dt><dd>{defaultSender?.name || "Не выбран"}</dd></div><div><dt>Документ</dt><dd>{settings.document.title}</dd></div><div><dt>НДС</dt><dd>{settings.defaults.vatRate ? `${settings.defaults.vatRate}%` : "Без НДС"}</dd></div><div><dt>Срок действия</dt><dd>{settings.defaults.validityDays} дней</dd></div><div><dt>Печать</dt><dd>{settings.stampAssetId ? settings.includeStampByDefault ? "Добавляется" : "Загружена" : "Нет файла"}</dd></div></dl><button type="submit" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить настройки"}</button><div className="quote-settings-feedback" aria-live="polite">{error ? <p className="error">{error}</p> : message ? <p className="success">{message}</p> : null}</div><small>Настройки действуют только для новых КП. Сохранённые редакции не изменятся.</small></aside>
  </form>;
}

function Field({ label, value, onChange, className, ...inputProps }: { label: string; value: string; onChange: (value: string) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <label className={className}><span>{label}</span><input {...inputProps} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
