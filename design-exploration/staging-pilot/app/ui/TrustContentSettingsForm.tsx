"use client";

import Image from "next/image";
import { useState } from "react";
import { trustCardImageUrl, type TrustCard, type TrustContentSettings } from "../data/trustContentModel";

export function TrustContentSettingsForm({ initial }: { initial: TrustContentSettings }) {
  const [settings, setSettings] = useState(initial);
  const [pending, setPending] = useState(false);
  const [uploadingCard, setUploadingCard] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateCard(index: number, patch: Partial<TrustCard>) {
    setSettings((current) => ({ ...current, cards:current.cards.map((card, cardIndex) => cardIndex === index ? { ...card, ...patch } : card) }));
  }

  async function uploadPhoto(index: number, file: File | undefined) {
    if (!file) return;
    const card = settings.cards[index];
    setUploadingCard(card.id);
    setMessage("");
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/trust-content/assets", { method:"POST", body:form });
      const result = await response.json() as { ok?: boolean; message?: string; assetId?: string };
      if (!response.ok || !result.ok || !result.assetId) throw new Error(result.message || "Фотография не загружена.");
      updateCard(index, { imageAssetId:result.assetId });
      setMessage(`Фотография для «${card.title}» загружена. Сохраните изменения, чтобы показать её на главной.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Фотография не загружена.");
    } finally {
      setUploadingCard(null);
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persist("PUT", settings, "Изменения опубликованы в локальном прототипе.");
  }

  async function resetDefaults() {
    if (!window.confirm("Вернуть стандартные тексты и фотографии блока доверия?")) return;
    await persist("DELETE", { revision:settings.revision }, "Восстановлены стандартные тексты и фотографии.");
  }

  async function persist(method: "PUT" | "DELETE", body: unknown, successMessage: string) {
    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/trust-content", { method, headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body) });
      const result = await response.json() as { ok?: boolean; message?: string; settings?: TrustContentSettings };
      if (!response.ok || !result.ok || !result.settings) throw new Error(result.message || "Изменения не сохранены.");
      setSettings(result.settings);
      setMessage(`${successMessage} Версия ${result.settings.revision}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Изменения не сохранены.");
    } finally {
      setPending(false);
    }
  }

  return <form className="trust-settings-layout" onSubmit={save}>
    <div className="trust-settings-main">
      <section className="quote-settings-card"><header><span>01</span><div><h2>Заголовок блока</h2><p>Объясняет, почему закупка через 7TOOL снижает риск ошибки.</p></div></header><div className="quote-settings-grid">
        <Field label="Надзаголовок" value={settings.sectionEyebrow} maxLength={70} onChange={(sectionEyebrow) => setSettings((current) => ({ ...current, sectionEyebrow }))} />
        <Field label="Основной заголовок" value={settings.sectionTitle} maxLength={110} onChange={(sectionTitle) => setSettings((current) => ({ ...current, sectionTitle }))} />
        <label className="wide"><span>Пояснение</span><textarea rows={3} maxLength={320} value={settings.sectionIntro} onChange={(event) => setSettings((current) => ({ ...current, sectionIntro:event.target.value }))} /></label>
      </div></section>

      {settings.cards.map((card, index) => <section className="quote-settings-card trust-settings-card" key={card.id}><header><span>{String(index + 2).padStart(2, "0")}</span><div><h2>{card.title}</h2><p>Текст и фотография этой карточки на главной странице.</p></div></header><div className="trust-settings-card-body">
        <div className="trust-settings-photo">
          <div><Image src={trustCardImageUrl(card)} alt={card.imageAlt || card.title} width={420} height={240} unoptimized={Boolean(card.imageAssetId)} /></div>
          <label className="trust-photo-upload"><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploadingCard === card.id} onChange={(event) => void uploadPhoto(index, event.target.files?.[0])} /><span>{uploadingCard === card.id ? "Загружаем…" : card.imageAssetId ? "Заменить фотографию" : "Загрузить фотографию"}</span></label>
          {card.imageAssetId ? <button type="button" onClick={() => updateCard(index, { imageAssetId:"" })}>Вернуть стандартное фото</button> : <small>Используется стандартное фото 7TOOL</small>}
        </div>
        <div className="quote-settings-grid">
          <Field label="Метка" value={card.kicker} maxLength={60} onChange={(kicker) => updateCard(index, { kicker })} />
          <Field label="Заголовок" value={card.title} maxLength={100} onChange={(title) => updateCard(index, { title })} />
          <label className="wide"><span>Пояснение</span><textarea rows={3} maxLength={300} value={card.text} onChange={(event) => updateCard(index, { text:event.target.value })} /></label>
          <Field className="wide" label="Результат для покупателя" value={card.outcome} maxLength={170} onChange={(outcome) => updateCard(index, { outcome })} />
          <Field className="wide" label="Описание фото для доступности" value={card.imageAlt} maxLength={160} onChange={(imageAlt) => updateCard(index, { imageAlt })} />
        </div>
      </div></section>)}
    </div>

    <aside className="trust-settings-preview">
      <span>Предпросмотр блока</span><h2>{settings.sectionTitle}</h2><p>{settings.sectionIntro}</p>
      <div>{settings.cards.map((card) => <article key={card.id}><Image src={trustCardImageUrl(card)} alt="" width={96} height={72} unoptimized={Boolean(card.imageAssetId)} /><div><small>{card.kicker}</small><b>{card.title}</b><span>{card.outcome}</span></div></article>)}</div>
      <button type="submit" disabled={pending || Boolean(uploadingCard)}>{pending ? "Сохраняем…" : "Сохранить и показать на главной"}</button>
      <button className="trust-settings-reset" type="button" disabled={pending} onClick={() => void resetDefaults()}>Вернуть стандартное содержимое</button>
      <div className="quote-settings-feedback" aria-live="polite">{error ? <p className="error">{error}</p> : message ? <p className="success">{message}</p> : null}</div>
      <small>Изменения видны после сохранения. Загруженные файлы хранятся локально и не отправляются во внешние сервисы.</small>
    </aside>
  </form>;
}

function Field({ label, value, onChange, className, ...inputProps }: { label: string; value: string; onChange: (value: string) => void; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <label className={className}><span>{label}</span><input {...inputProps} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
