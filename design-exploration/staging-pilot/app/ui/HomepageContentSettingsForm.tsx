"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { homepageAssetUrl, type HomepageContentSettings, type HomepageImageFit, type HomepageImagePosition, type HomepageMediaItem, type HomepageTextSection } from "../data/homepageContentModel";

export type HomepageCatalogReference = { id: string; href: string; count: number; fallbackImage: string };

export function HomepageContentSettingsForm({ initial, references }: { initial: HomepageContentSettings; references: HomepageCatalogReference[] }) {
  const [settings, setSettings] = useState(initial);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const referenceById = useMemo(() => new Map(references.map((reference) => [reference.id, reference])), [references]);

  function updateSection(key: "hero" | "assortment" | "categories" | "tasks", patch: Partial<HomepageTextSection>) {
    setSettings((current) => ({ ...current, [key]:{ ...current[key], ...patch } }));
  }

  function updateItem(collection: "assortmentItems" | "categoryItems", id: string, patch: Partial<HomepageMediaItem>) {
    setSettings((current) => ({ ...current, [collection]:current[collection].map((item) => item.id === id ? { ...item, ...patch } : item) }));
  }

  function moveItem(collection: "assortmentItems" | "categoryItems", index: number, direction: -1 | 1) {
    setSettings((current) => {
      const items = [...current[collection]];
      const target = index + direction;
      if (target < 0 || target >= items.length) return current;
      [items[index], items[target]] = [items[target], items[index]];
      return { ...current, [collection]:items };
    });
  }

  async function uploadPhoto(collection: "assortmentItems" | "categoryItems", item: HomepageMediaItem, file: File | undefined) {
    if (!file) return;
    const uploadKey = `${collection}:${item.id}`;
    setUploading(uploadKey);
    setMessage("");
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/homepage-content/assets", { method:"POST", body:form });
      const result = await response.json() as { ok?: boolean; message?: string; assetId?: string };
      if (!response.ok || !result.ok || !result.assetId) throw new Error(result.message || "Фотография не загружена.");
      updateItem(collection, item.id, { imageAssetId:result.assetId });
      setMessage(`Фотография «${item.title}» загружена. Сохраните страницу, чтобы опубликовать изменение.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Фотография не загружена.");
    } finally {
      setUploading("");
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persist("PUT", settings, "Главная страница сохранена.");
  }

  async function resetDefaults() {
    if (!window.confirm("Вернуть стандартные тексты, порядок и фотографии главной страницы?")) return;
    await persist("DELETE", { revision:settings.revision }, "Восстановлено стандартное содержимое главной страницы.");
  }

  async function persist(method: "PUT" | "DELETE", body: unknown, successMessage: string) {
    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/homepage-content", { method, headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body) });
      const result = await response.json() as { ok?: boolean; message?: string; settings?: HomepageContentSettings };
      if (!response.ok || !result.ok || !result.settings) throw new Error(result.message || "Изменения не сохранены.");
      setSettings(result.settings);
      setMessage(`${successMessage} Версия ${result.settings.revision}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Изменения не сохранены.");
    } finally {
      setPending(false);
    }
  }

  const imageUrl = (item: HomepageMediaItem) => item.imageAssetId ? homepageAssetUrl(item.imageAssetId) : referenceById.get(item.id)?.fallbackImage || "/brand/7tool-primary.svg";

  return <form className="homepage-settings-layout" onSubmit={save}>
    <div className="homepage-settings-mobile-bar">
      <button type="submit" disabled={pending || Boolean(uploading)}>{pending ? "Сохраняем…" : "Сохранить изменения"}</button>
      <a href="/" target="_blank" rel="noreferrer">Посмотреть главную ↗</a>
    </div>
    <div className="homepage-settings-main">
      <EditorSection number="01" title="Первый экран" description="Главное обещание и объяснение ассортимента. Кнопки, контакты и ссылки остаются системными.">
        <TextSectionFields value={settings.hero} onChange={(patch) => updateSection("hero", patch)} introLabel="Пояснение под заголовком" />
      </EditorSection>

      <EditorSection number="02" title="Разделы каталога в первом экране" description="Шесть конкретных товарных разделов вместо абстрактной карты ассортимента. Порядок и фотографии можно менять, ссылки и количество товаров остаются привязаны к каталогу.">
        <TextSectionFields value={settings.categories} onChange={(patch) => updateSection("categories", patch)} />
        <MediaEditorList collection="categoryItems" items={settings.categoryItems} references={referenceById} uploading={uploading} imageUrl={imageUrl} onUpdate={updateItem} onMove={moveItem} onUpload={uploadPhoto} />
      </EditorSection>

      <EditorSection number="03" title="Подбор по производственной задаче" description="Текст над автоматически сформированной картой задач. Состав категорий берётся из фида.">
        <TextSectionFields value={settings.tasks} onChange={(patch) => updateSection("tasks", patch)} />
      </EditorSection>
    </div>

    <aside className="homepage-settings-preview">
      <div className="homepage-settings-preview-head"><span>Живой предпросмотр</span><a href="/" target="_blank" rel="noreferrer">Открыть главную ↗</a></div>
      <div className="homepage-mini-hero"><small>{settings.hero.eyebrow}</small><h2>{settings.hero.title}</h2><p>{settings.hero.intro}</p></div>
      <PreviewGrid title={settings.categories.title} items={settings.categoryItems} imageUrl={imageUrl} large />
      <button className="homepage-settings-save" type="submit" disabled={pending || Boolean(uploading)}>{pending ? "Сохраняем…" : "Сохранить и показать на главной"}</button>
      <button className="homepage-settings-reset" type="button" disabled={pending} onClick={() => void resetDefaults()}>Вернуть стандартное содержимое</button>
      <div className="quote-settings-feedback" aria-live="polite">{error ? <p className="error">{error}</p> : message ? <p className="success">{message}</p> : null}</div>
      <small>Сначала настройте кадрирование в предпросмотре, затем сохраните. Исходные пропорции файла не меняют высоту карточек.</small>
    </aside>
  </form>;
}

function EditorSection({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="quote-settings-card homepage-settings-card"><header><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></header>{children}</section>;
}

function TextSectionFields({ value, onChange, introLabel = "Пояснение" }: { value: HomepageTextSection; onChange: (patch: Partial<HomepageTextSection>) => void; introLabel?: string }) {
  return <div className="quote-settings-grid homepage-copy-fields">
    <Field label="Надзаголовок" value={value.eyebrow} maxLength={70} onChange={(eyebrow) => onChange({ eyebrow })} />
    <Field label="Основной заголовок" value={value.title} maxLength={130} onChange={(title) => onChange({ title })} />
    <label className="wide"><span>{introLabel}</span><textarea rows={3} maxLength={420} value={value.intro} onChange={(event) => onChange({ intro:event.target.value })} /></label>
  </div>;
}

function MediaEditorList({ collection, items, references, uploading, imageUrl, onUpdate, onMove, onUpload }: {
  collection: "assortmentItems" | "categoryItems";
  items: HomepageMediaItem[];
  references: Map<string, HomepageCatalogReference>;
  uploading: string;
  imageUrl: (item: HomepageMediaItem) => string;
  onUpdate: (collection: "assortmentItems" | "categoryItems", id: string, patch: Partial<HomepageMediaItem>) => void;
  onMove: (collection: "assortmentItems" | "categoryItems", index: number, direction: -1 | 1) => void;
  onUpload: (collection: "assortmentItems" | "categoryItems", item: HomepageMediaItem, file: File | undefined) => Promise<void>;
}) {
  return <div className="homepage-media-editor-list">{items.map((item, index) => {
    const uploadKey = `${collection}:${item.id}`;
    const reference = references.get(item.id);
    return <article className="homepage-media-editor" key={item.id}>
      <div className="homepage-media-editor-image" data-fit={item.imageFit} data-position={item.imagePosition}><Image src={imageUrl(item)} alt={item.imageAlt} fill sizes="190px" unoptimized /></div>
      <div className="homepage-media-editor-fields">
        <div className="homepage-media-editor-title"><b>{item.title}</b><small>{reference?.count ? formatProductCount(reference.count) : "Раздел каталога"} · ссылка фиксирована</small></div>
        <Field label="Название на главной" value={item.title} maxLength={90} onChange={(title) => onUpdate(collection, item.id, { title })} />
        <Field label="Описание изображения" value={item.imageAlt} maxLength={170} onChange={(imageAlt) => onUpdate(collection, item.id, { imageAlt })} />
        <label><span>Как вписать фото</span><select value={item.imageFit} onChange={(event) => onUpdate(collection, item.id, { imageFit:event.target.value as HomepageImageFit })}><option value="contain">Показать товар целиком</option><option value="cover">Заполнить карточку</option></select></label>
        <label><span>Положение в кадре</span><select value={item.imagePosition} onChange={(event) => onUpdate(collection, item.id, { imagePosition:event.target.value as HomepageImagePosition })}><option value="center">По центру</option><option value="top">Сверху</option><option value="bottom">Снизу</option><option value="left">Слева</option><option value="right">Справа</option></select></label>
      </div>
      <div className="homepage-media-editor-actions">
        <label className="homepage-media-upload"><input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading === uploadKey} onChange={(event) => void onUpload(collection, item, event.target.files?.[0])} /><span>{uploading === uploadKey ? "Загрузка…" : item.imageAssetId ? "Заменить фото" : "Загрузить фото"}</span></label>
        {item.imageAssetId && <button type="button" onClick={() => onUpdate(collection, item.id, { imageAssetId:"" })}>Вернуть фото из каталога</button>}
        <div><button type="button" aria-label={`Поднять ${item.title}`} disabled={index === 0} onClick={() => onMove(collection, index, -1)}>↑</button><button type="button" aria-label={`Опустить ${item.title}`} disabled={index === items.length - 1} onClick={() => onMove(collection, index, 1)}>↓</button></div>
      </div>
    </article>;
  })}</div>;
}

function PreviewGrid({ title, items, imageUrl, large = false }: { title: string; items: HomepageMediaItem[]; imageUrl: (item: HomepageMediaItem) => string; large?: boolean }) {
  return <div className={`homepage-mini-grid${large ? " homepage-mini-grid--large" : ""}`}><b>{title}</b><div>{items.map((item) => <article key={item.id}><span data-fit={item.imageFit} data-position={item.imagePosition}><Image src={imageUrl(item)} alt="" fill sizes="100px" unoptimized /></span><small>{item.title}</small></article>)}</div></div>;
}

function Field({ label, value, onChange, ...inputProps }: { label: string; value: string; onChange: (value: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return <label><span>{label}</span><input {...inputProps} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function formatProductCount(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const noun = mod100 >= 11 && mod100 <= 14 ? "товаров" : mod10 === 1 ? "товар" : mod10 >= 2 && mod10 <= 4 ? "товара" : "товаров";
  return `${count} ${noun}`;
}
