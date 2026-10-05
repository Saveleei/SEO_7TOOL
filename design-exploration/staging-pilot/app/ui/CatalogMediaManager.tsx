"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CatalogProductMediaRecord } from "../data/catalogProductMediaStore";

export type CatalogMediaManagerItem = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  sku: string;
  category: string;
  stock: number;
  variantCount: number;
  price: string;
  queueCode: string;
  queueLabel: string;
  queueInstruction: string;
  state: "unmanaged" | "draft" | "published" | "disabled";
  image?: string;
  record?: CatalogProductMediaRecord;
};

export function CatalogMediaManager({ initialRevision, items, totalMatching }: { initialRevision: number; items: CatalogMediaManagerItem[]; totalMatching: number }) {
  const router = useRouter();
  const [revision, setRevision] = useState(initialRevision);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function upload(item: CatalogMediaManagerItem, form: HTMLFormElement) {
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Выберите фотографию товара.");
    formData.set("productId", item.id);
    formData.set("revision", String(revision));
    await mutate(item.id, () => fetch("/api/catalog-media", { method:"POST", body:formData }), `Фото «${item.title}» загружено как черновик.`);
  }

  async function action(item: CatalogMediaManagerItem, actionName: "publish" | "disable" | "enable" | "restore" | "discard_draft", assetId?: string) {
    const labels = { publish:"Фотография опубликована.", disable:"Ручная фотография отключена.", enable:"Фотография снова опубликована.", restore:"Выбранная версия восстановлена.", discard_draft:"Черновик удалён." };
    await mutate(item.id, () => fetch(`/api/catalog-media/${encodeURIComponent(item.id)}`, { method:"PATCH", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ action:actionName, assetId, revision }) }), labels[actionName]);
  }

  async function mutate(productId: string, request: () => Promise<Response>, success: string) {
    setPending(productId);
    setMessage("");
    setError("");
    try {
      const response = await request();
      const result = await response.json() as { ok?: boolean; message?: string; settings?: { revision: number } };
      if (!response.ok || !result.ok || !result.settings) throw new Error(result.message || "Изменение не сохранено.");
      setRevision(result.settings.revision);
      setMessage(success);
      router.refresh();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Изменение не сохранено.");
    } finally {
      setPending("");
    }
  }

  return <section className="catalog-media-workspace" aria-labelledby="catalog-media-list-title">
    <header><div><p className="eyebrow">Рабочая очередь</p><h2 id="catalog-media-list-title">Проверка и публикация</h2></div><span>{totalMatching.toLocaleString("ru-RU")} совпадений{totalMatching > items.length ? ` · показаны первые ${items.length}` : ""}</span></header>
    <div className="catalog-media-feedback" aria-live="polite">{error ? <p className="error">{error}</p> : message ? <p className="success">{message}</p> : null}</div>
    {items.length > 0 ? <div className="catalog-media-list">{items.map((item) => <MediaItem key={item.id} item={item} busy={pending === item.id} onUpload={upload} onAction={action} />)}</div> : <div className="catalog-media-empty"><b>В этой очереди товаров нет</b><p>Измените фильтры или вернитесь к полному списку.</p><Link href="/test/catalog-media?queue=all">Показать все очереди</Link></div>}
  </section>;
}

function MediaItem({ item, busy, onUpload, onAction }: {
  item: CatalogMediaManagerItem;
  busy: boolean;
  onUpload: (item: CatalogMediaManagerItem, form: HTMLFormElement) => Promise<void>;
  onAction: (item: CatalogMediaManagerItem, action: "publish" | "disable" | "enable" | "restore" | "discard_draft", assetId?: string) => Promise<void>;
}) {
  const [historyAsset, setHistoryAsset] = useState("");
  const published = item.record?.versions.find((version) => version.assetId === item.record?.publishedAssetId);
  const draft = item.record?.versions.find((version) => version.assetId === item.record?.draftAssetId);
  return <article className="catalog-media-item">
    <div className="catalog-media-item-main">
      <div className="catalog-media-product-image">{item.image ? <Image src={item.image} alt={item.title} fill sizes="180px" unoptimized /> : <span>Фото<br />не загружено</span>}</div>
      <div className="catalog-media-product-copy"><div className="catalog-media-badges"><span data-state={item.state}>{stateLabel(item.state)}</span><span>{item.queueLabel}</span></div><h3>{item.title}</h3><p>{item.brand || "Бренд не указан"}{item.sku ? ` · ${item.sku}` : " · без артикула"}</p><small>{item.stock > 0 ? `В наличии: ${item.stock}` : "Положительный остаток не подтверждён"} · {item.variantCount} исполнений</small><p className="catalog-media-instruction">{item.queueInstruction}</p><div className="catalog-media-links"><Link href={`/p/${item.slug}`} target="_blank">Открыть товар ↗</Link><Link href={`/c/${item.category}`} target="_blank">Открыть категорию ↗</Link></div></div>
    </div>
    <div className="catalog-media-preview" aria-label="Предпросмотр фотографии"><span>Предпросмотр в каталоге</span><div><div className="catalog-media-preview-image">{item.image ? <Image src={item.image} alt="" fill sizes="120px" unoptimized /> : <i>7T</i>}</div><section><small>{item.brand}</small><b>{item.title}</b><em>{item.price}</em></section></div></div>
    <form className="catalog-media-upload" onSubmit={(event) => { event.preventDefault(); void onUpload(item, event.currentTarget); }}><label><span>Точная страница-источник</span><input name="sourceUrl" type="url" inputMode="url" required maxLength={1000} defaultValue={draft?.sourceUrl ?? published?.sourceUrl ?? ""} placeholder="https://manufacturer.example/product/model" /></label><label className="catalog-media-file"><input name="file" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} /><span>{item.record ? "Заменить фотографию" : "Выбрать фотографию"}</span><small>PNG, JPG или WebP · до 5 МБ</small></label><button type="submit" disabled={busy}>{busy ? "Сохраняем…" : "Загрузить как черновик"}</button></form>
    {item.record ? <div className="catalog-media-controls">
      <div>{item.record.draftAssetId ? <><button type="button" disabled={busy} onClick={() => void onAction(item, "publish")}>Опубликовать черновик</button><button className="secondary" type="button" disabled={busy} onClick={() => void onAction(item, "discard_draft")}>Удалить черновик</button></> : null}{item.state === "published" ? <button className="danger" type="button" disabled={busy} onClick={() => void onAction(item, "disable")}>Отключить ручное фото</button> : null}{item.state === "disabled" && item.record.publishedAssetId ? <button type="button" disabled={busy} onClick={() => void onAction(item, "enable")}>Включить снова</button> : null}</div>
      {item.record.versions.length > 1 ? <div className="catalog-media-restore"><label><span>Предыдущая версия</span><select value={historyAsset} onChange={(event) => setHistoryAsset(event.target.value)}><option value="">Выберите версию</option>{[...item.record.versions].reverse().map((version) => <option value={version.assetId} key={version.assetId}>{new Date(version.uploadedAt).toLocaleString("ru-RU")} · {formatBytes(version.size)}</option>)}</select></label><button className="secondary" type="button" disabled={busy || !historyAsset} onClick={() => void onAction(item, "restore", historyAsset)}>Восстановить</button></div> : null}
      <details className="catalog-media-audit"><summary>Журнал действий · {item.record.events.length}</summary><ol>{[...item.record.events].reverse().slice(0, 10).map((event) => <li key={event.id}><b>{eventLabel(event.action)}</b><span>{new Date(event.at).toLocaleString("ru-RU")} · {event.actor}</span></li>)}</ol></details>
    </div> : null}
  </article>;
}

function stateLabel(state: CatalogMediaManagerItem["state"]) {
  return state === "draft" ? "Черновик" : state === "published" ? "Опубликовано" : state === "disabled" ? "Отключено" : "Не начато";
}

function eventLabel(action: CatalogProductMediaRecord["events"][number]["action"]) {
  return ({ upload:"Загружен черновик", publish:"Опубликовано", disable:"Отключено", enable:"Включено", restore:"Восстановлена версия", discard_draft:"Удалён черновик" })[action];
}

function formatBytes(value: number) {
  return value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1)} МБ` : `${Math.ceil(value / 1000)} КБ`;
}
