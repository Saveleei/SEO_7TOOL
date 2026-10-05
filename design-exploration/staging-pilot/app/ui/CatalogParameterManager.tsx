"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CatalogParameterOverride, CatalogParameterOverrideRecord } from "../data/catalogParameterOverrideStore";

export type CatalogParameterManagerItem = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  sku: string;
  category: string;
  categoryTitle: string;
  state: "unmanaged" | "draft" | "published" | "disabled";
  missingParameters: string[];
  variants: Array<{ id: string; sku: string; name: string; params: Array<{ name: string; value: string; unit?: string }> }>;
  record?: CatalogParameterOverrideRecord;
};

type EditableRow = { id: string; target: string; name: string; value: string; unit: string };

export function CatalogParameterManager({ initialRevision, items, totalMatching }: { initialRevision: number; items: CatalogParameterManagerItem[]; totalMatching: number }) {
  const router = useRouter();
  const [revision, setRevision] = useState(initialRevision);
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveDraft(item: CatalogParameterManagerItem, payload: { parameters: CatalogParameterOverride[]; sourceUrl: string; note: string }) {
    await mutate(item.id, () => fetch("/api/catalog-parameters", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ productId:item.id, revision, ...payload }) }), `Черновик для «${item.title}» сохранён. Проверьте его перед публикацией.`);
  }

  async function action(item: CatalogParameterManagerItem, actionName: "publish" | "discard_draft" | "disable" | "enable" | "restore", versionId?: string) {
    const labels = { publish:"Проверенные характеристики опубликованы поверх фида.", discard_draft:"Черновик удалён.", disable:"Ручные характеристики отключены.", enable:"Опубликованные характеристики снова включены.", restore:"Выбранная версия восстановлена." };
    await mutate(item.id, () => fetch(`/api/catalog-parameters/${encodeURIComponent(item.id)}`, { method:"PATCH", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ action:actionName, versionId, revision }) }), labels[actionName]);
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

  return <section className="catalog-parameter-workspace" aria-labelledby="catalog-parameter-list-title"><header><div><p className="eyebrow">Рабочая очередь</p><h2 id="catalog-parameter-list-title">Черновики и публикация</h2></div><span>{totalMatching.toLocaleString("ru-RU")} совпадений{totalMatching > items.length ? ` · показаны первые ${items.length}` : ""}</span></header><div className="catalog-parameter-feedback" aria-live="polite">{error ? <p className="error">{error}</p> : message ? <p className="success">{message}</p> : null}</div>{items.length > 0 ? <div className="catalog-parameter-list">{items.map((item) => <ParameterItem key={`${item.id}:${item.record?.updatedAt ?? "new"}`} item={item} busy={pending === item.id} onSave={saveDraft} onAction={action} />)}</div> : <div className="catalog-parameter-empty"><b>По выбранным условиям товаров нет</b><p>Измените фильтры или вернитесь к очереди качества.</p><Link href="/test/catalog-quality">Открыть качество каталога</Link></div>}</section>;
}

function ParameterItem({ item, busy, onSave, onAction }: {
  item: CatalogParameterManagerItem;
  busy: boolean;
  onSave: (item: CatalogParameterManagerItem, payload: { parameters: CatalogParameterOverride[]; sourceUrl: string; note: string }) => Promise<void>;
  onAction: (item: CatalogParameterManagerItem, action: "publish" | "discard_draft" | "disable" | "enable" | "restore", versionId?: string) => Promise<void>;
}) {
  const draft = item.record?.versions.find((version) => version.id === item.record?.draftVersionId);
  const published = item.record?.versions.find((version) => version.id === item.record?.publishedVersionId);
  const seed = draft ?? published;
  const [rows, setRows] = useState<EditableRow[]>(() => seed?.parameters.map(toEditableRow) ?? suggestedRows(item.missingParameters));
  const [sourceUrl, setSourceUrl] = useState(seed?.sourceUrl ?? "");
  const [note, setNote] = useState(seed?.note ?? "");
  const [historyVersion, setHistoryVersion] = useState("");
  const currentParameters = uniqueCurrentParameters(item).slice(0, 12);

  function updateRow(id: string, patch: Partial<EditableRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parameters = rows.map((row): CatalogParameterOverride => row.target === "product"
      ? { target:"product", name:row.name, value:row.value, ...(row.unit ? { unit:row.unit } : {}) }
      : { target:"variant", variantId:row.target.slice("variant:".length), name:row.name, value:row.value, ...(row.unit ? { unit:row.unit } : {}) });
    void onSave(item, { parameters, sourceUrl, note });
  }

  return <article className="catalog-parameter-item"><header><div className="catalog-parameter-item-copy"><div className="catalog-parameter-badges"><span data-state={item.state}>{stateLabel(item.state)}</span><span>{item.categoryTitle}</span></div><h3>{item.title}</h3><p>{item.brand || "Бренд не указан"}{item.sku ? ` · ${item.sku}` : " · без артикула"} · {item.variants.length} исполнений</p><div className="catalog-parameter-links"><Link href={`/p/${item.slug}`} target="_blank">Карточка товара ↗</Link><Link href={`/c/${item.category}`} target="_blank">Категория ↗</Link></div></div>{item.missingParameters.length > 0 ? <div className="catalog-parameter-missing"><small>Не хватает для подбора</small><div>{item.missingParameters.slice(0, 6).map((parameter) => <span key={parameter}>{parameter}</span>)}</div></div> : <div className="catalog-parameter-missing is-neutral"><small>Подсказка</small><p>Сначала определите решающие параметры по паспорту.</p></div>}</header>
    <form className="catalog-parameter-editor" onSubmit={submit}><div className="catalog-parameter-editor-head"><div><b>Новый черновик</b><p>Область каждой строки нужно выбрать вручную: серия или точное исполнение.</p></div><button type="button" onClick={() => setRows((current) => [...current, blankRow()])}>+ Добавить параметр</button></div><div className="catalog-parameter-rows">{rows.map((row, index) => <div className="catalog-parameter-row" key={row.id}><span>{index + 1}</span><label><small>К чему относится</small><select value={row.target} onChange={(event) => updateRow(row.id, { target:event.target.value })} required><option value="" disabled>Выберите область</option><option value="product">Вся серия · общее значение</option>{item.variants.map((variant) => <option value={`variant:${variant.id}`} key={variant.id}>{variant.sku || variant.id} · конкретное исполнение</option>)}</select></label><label><small>Характеристика</small><input value={row.name} onChange={(event) => updateRow(row.id, { name:event.target.value })} required maxLength={120} placeholder="Например, положение сварки" /></label><label><small>Значение</small><input value={row.value} onChange={(event) => updateRow(row.id, { value:event.target.value })} required maxLength={240} placeholder="Например, вертикальное снизу вверх" /></label><label><small>Единица</small><input value={row.unit} onChange={(event) => updateRow(row.id, { unit:event.target.value })} maxLength={30} placeholder="мм" /></label><button className="catalog-parameter-remove" type="button" aria-label={`Удалить параметр ${index + 1}`} disabled={rows.length === 1} onClick={() => setRows((current) => current.filter((candidate) => candidate.id !== row.id))}>×</button></div>)}</div><div className="catalog-parameter-source"><label><span>Точная ссылка на источник</span><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} required maxLength={1000} placeholder="https://manufacturer.example/model/passport.pdf" /></label><label><span>Комментарий проверки</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={600} rows={2} placeholder="Страница паспорта, таблица или пояснение к общему параметру" /></label></div><div className="catalog-parameter-editor-actions"><button type="submit" disabled={busy}>{busy ? "Сохраняем…" : "Сохранить как черновик"}</button><small>Покупатели не увидят черновик. После сохранения отдельно нажмите «Опубликовать».</small></div></form>
    <div className="catalog-parameter-review"><section><b>Сейчас в фиде и опубликованных корректировках</b>{currentParameters.length > 0 ? <dl>{currentParameters.map((parameter) => <div key={`${parameter.name}:${parameter.value}`}><dt>{parameter.name}</dt><dd>{parameter.value}{parameter.unit ? ` ${parameter.unit}` : ""}</dd></div>)}</dl> : <p>Структурированных характеристик пока нет.</p>}</section><section><b>Контроль версии</b>{item.record ? <><p>{draft ? `Черновик: ${draft.parameters.length} параметров · ${formatDate(draft.createdAt)}` : "Новых неопубликованных изменений нет."}</p><div className="catalog-parameter-controls">{draft ? <><button type="button" disabled={busy} onClick={() => void onAction(item, "publish")}>Опубликовать после проверки</button><button className="secondary" type="button" disabled={busy} onClick={() => void onAction(item, "discard_draft")}>Удалить черновик</button></> : null}{item.state === "published" ? <button className="danger" type="button" disabled={busy} onClick={() => void onAction(item, "disable")}>Отключить корректировки</button> : null}{item.state === "disabled" && item.record.publishedVersionId ? <button type="button" disabled={busy} onClick={() => void onAction(item, "enable")}>Включить снова</button> : null}</div>{item.record.versions.length > 1 ? <div className="catalog-parameter-restore"><select aria-label="Предыдущая версия" value={historyVersion} onChange={(event) => setHistoryVersion(event.target.value)}><option value="">Выберите предыдущую версию</option>{[...item.record.versions].reverse().map((version) => <option value={version.id} key={version.id}>{formatDate(version.createdAt)} · {version.parameters.length} параметров</option>)}</select><button className="secondary" type="button" disabled={busy || !historyVersion} onClick={() => void onAction(item, "restore", historyVersion)}>Восстановить и опубликовать</button></div> : null}<details className="catalog-parameter-audit"><summary>Журнал действий · {item.record.events.length}</summary><ol>{[...item.record.events].reverse().slice(0, 12).map((event) => <li key={event.id}><b>{eventLabel(event.action)}</b><span>{formatDate(event.at)} · {event.actor}</span></li>)}</ol></details></> : <p>Для товара ещё нет ручных корректировок.</p>}</section></div>
  </article>;
}

function suggestedRows(parameters: string[]): EditableRow[] {
  const suggestions = parameters.slice(0, 5);
  return suggestions.length > 0 ? suggestions.map((name) => ({ ...blankRow(), name })) : [blankRow()];
}

function blankRow(): EditableRow {
  return { id:crypto.randomUUID(), target:"", name:"", value:"", unit:"" };
}

function toEditableRow(parameter: CatalogParameterOverride): EditableRow {
  return { id:crypto.randomUUID(), target:parameter.target === "variant" ? `variant:${parameter.variantId}` : "product", name:parameter.name, value:parameter.value, unit:parameter.unit ?? "" };
}

function uniqueCurrentParameters(item: CatalogParameterManagerItem) {
  const seen = new Set<string>();
  return item.variants.flatMap((variant) => variant.params).filter((parameter) => {
    const key = `${parameter.name}:${parameter.value}:${parameter.unit ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stateLabel(state: CatalogParameterManagerItem["state"]) {
  return state === "draft" ? "Черновик" : state === "published" ? "Опубликовано" : state === "disabled" ? "Отключено" : "Не начато";
}

function eventLabel(action: CatalogParameterOverrideRecord["events"][number]["action"]) {
  return ({ save_draft:"Сохранён черновик", publish:"Опубликовано", discard_draft:"Удалён черновик", disable:"Отключено", enable:"Включено", restore:"Восстановлена версия" })[action];
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU");
}
