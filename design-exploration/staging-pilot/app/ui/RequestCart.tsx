"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { parseQuotePrice, sanitizeRequestItems, summarizeRequest } from "../data/requestQuote.mjs";
import { buildRequestSource } from "../data/requestAttribution";
import { ManagerContactCard } from "./ManagerContactCard";

export type RequestItem = {
  id: string;
  title: string;
  article: string;
  price?: string;
  quantity?: number;
  image?: string;
  href?: string;
  shippingLabel?: string;
  shippingDetail?: string;
};

type RequestCartValue = {
  items: RequestItem[];
  addItem: (item: RequestItem, analytics?: QuoteItemAnalytics) => void;
  open: () => void;
  close: () => void;
  closeConfirmation: () => void;
  updateQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  isOpen: boolean;
  confirmationItem: RequestItem | null;
};

type QuoteItemAnalytics = {
  placement?: string;
  page_type?: string;
  product_id?: string;
  variant_id?: string;
  category?: string;
};

const STORAGE_KEY = "7tool:quote-draft:v1";
const FOCUSABLE_SELECTOR = "a[href],button:not([disabled]),input:not([disabled]):not([type='hidden']),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex='-1'])";
const RequestCartContext = createContext<RequestCartValue | null>(null);

export function RequestCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [confirmationItem, setConfirmationItem] = useState<RequestItem | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let restoredItems: RequestItem[] = [];
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) restoredItems = sanitizeRequestItems(JSON.parse(stored)) as RequestItem[];
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    const restoreTimer = window.setTimeout(() => {
      setItems(restoredItems);
      setRestored(true);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (restored) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, restored]);

  function addItem(item: RequestItem, analytics: QuoteItemAnalytics = {}) {
    setItems((current) => {
      const existing = current.find((currentItem) => currentItem.id === item.id);
      return existing
        ? current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, ...item, quantity:Math.min(999, (currentItem.quantity ?? 1) + (item.quantity ?? 1)) } : currentItem)
        : [...current, { ...item, quantity:item.quantity ?? 1 }];
    });
    setConfirmationItem({ ...item, quantity:item.quantity ?? 1 });
    trackQuote("add_to_quote", { ...inferQuoteItemAnalytics(item), ...analytics });
  }

  function updateQuantity(id: string, quantity: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, quantity:Math.min(999, Math.max(1, quantity)) } : item));
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    trackQuote("remove_from_quote", { placement:"quote_drawer" });
  }

  function open() {
    setConfirmationItem(null);
    setIsOpen(true);
    void refreshShippingPromises();
    trackQuote("open_quote", { placement:"quote_trigger", item_count:items.length });
  }

  async function refreshShippingPromises() {
    const variantIds = Array.from(new Set(items.flatMap((item) => item.id.startsWith("variant:") ? [item.id.slice("variant:".length)] : [])));
    if (variantIds.length === 0) return;
    const trackedIds = new Set(variantIds.map((id) => `variant:${id}`));
    setItems((current) => current.map((item) => trackedIds.has(item.id) ? { ...item, shippingLabel:"Проверяем отгрузку…", shippingDetail:"Обновляем статус по серверному времени" } : item));
    try {
      const query = new URLSearchParams();
      variantIds.forEach((id) => query.append("variant", id));
      const response = await fetch(`/api/shipping-promises?${query.toString()}`, { headers:{ Accept:"application/json" }, cache:"no-store" });
      const payload = await response.json() as { ok?: boolean; promises?: Record<string, unknown> };
      if (!response.ok || !payload.ok || !payload.promises) throw new Error("shipping_promises_unavailable");
      setItems((current) => current.map((item) => {
        if (!item.id.startsWith("variant:")) return item;
        const promise = payload.promises?.[item.id.slice("variant:".length)];
        return isCartShippingPromise(promise) ? { ...item, shippingLabel:promise.label, shippingDetail:promise.detail } : { ...item, shippingLabel:"Наличие и срок уточняем", shippingDetail:"Менеджер подтвердит остаток и ближайшую дату отгрузки" };
      }));
    } catch {
      setItems((current) => current.map((item) => trackedIds.has(item.id) ? { ...item, shippingLabel:"Наличие и срок уточняем", shippingDetail:"Менеджер подтвердит остаток и ближайшую дату отгрузки" } : item));
    }
  }

  const close = useCallback(() => setIsOpen(false), []);
  const closeConfirmation = useCallback(() => setConfirmationItem(null), []);
  const value = { items, isOpen, confirmationItem, addItem, open, close, closeConfirmation, updateQuantity, remove };
  return <RequestCartContext.Provider value={value}>{children}<RequestAddConfirmation /><RequestCartDock /><RequestCartDrawer /></RequestCartContext.Provider>;
}

export function useRequestCart(): RequestCartValue {
  const value = useContext(RequestCartContext);
  if (!value) throw new Error("useRequestCart must be used within RequestCartProvider");
  return value;
}

export function RequestCartButton({ compact = false }: { compact?: boolean }) {
  const { items, open } = useRequestCart();
  const { totalQuantity } = summarizeRequest(items);
  return <button className={compact ? "request-cart-trigger request-cart-trigger--compact" : "request-cart-trigger"} type="button" onClick={open} aria-label={`Открыть запрос КП, позиций: ${items.length}, единиц: ${totalQuantity}`}>{compact ? <><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5h11l3 3v14H5zm10 1.8v2.2h2.2M8 11h8M8 15h8" /></svg><span>КП</span></> : <span>КП</span>}{items.length > 0 && <b>{items.length}</b>}</button>;
}

export function AddRequestButton({ item, className, children, openWhenAdded = false, openAfterAdd = false }: { item: RequestItem; className?: string; children?: ReactNode; openWhenAdded?: boolean; openAfterAdd?: boolean }) {
  const { items, addItem, open } = useRequestCart();
  const added = items.some((current) => current.id === item.id);
  const buttonClassName = [className, added ? "request-item-added" : ""].filter(Boolean).join(" ") || undefined;
  const activate = () => {
    if (added && (openWhenAdded || openAfterAdd)) { open(); return; }
    addItem(item);
    if (openAfterAdd) open();
  };
  const addedLabel = added ? "Добавлено · ещё +1" : children ?? "В запрос";
  const buttonLabel = added && (openWhenAdded || openAfterAdd) ? "Открыть КП" : addedLabel;
  return <button className={buttonClassName} type="button" onClick={activate} aria-live="polite">{buttonLabel}</button>;
}

function inferQuoteItemAnalytics(item: RequestItem): QuoteItemAnalytics {
  const productId = item.href?.match(/^\/product\/([^?#/]+)/u)?.[1];
  const category = window.location.pathname.match(/^\/catalog\/category\/([^/]+)/u)?.[1];
  return {
    placement:category ? "category_product_action" : "product_action",
    page_type:category ? "category" : window.location.pathname.startsWith("/p/") ? "product" : "other",
    product_id:productId,
    variant_id:item.id.startsWith("variant:") ? item.id.slice("variant:".length) : undefined,
    category,
  };
}

function RequestCartDock() {
  const { items, isOpen, confirmationItem, open } = useRequestCart();
  const { totalQuantity } = summarizeRequest(items);
  if (items.length === 0 || isOpen || confirmationItem) return null;
  return <div className="request-cart-dock" role="status" aria-live="polite"><div><span>Черновик КП</span><b>{items.length} поз. · {totalQuantity} шт.</b></div><button type="button" onClick={open}>Проверить запрос</button></div>;
}

function RequestAddConfirmation() {
  const { items, confirmationItem, closeConfirmation, open } = useRequestCart();
  const dialogRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const currentItem = confirmationItem ? items.find((item) => item.id === confirmationItem.id) ?? confirmationItem : null;
  const summary = useMemo(() => summarizeRequest(items), [items]);

  useEffect(() => {
    if (!confirmationItem) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    continueRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeConfirmation(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("keydown", closeOnEscape); returnFocusRef.current?.focus(); };
  }, [confirmationItem, closeConfirmation]);

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter((element) => element.offsetParent !== null);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  if (!currentItem) return null;
  const media = currentItem.image ? <Image src={currentItem.image} alt="" width={76} height={76} unoptimized /> : <span aria-hidden="true">7T</span>;
  return <div className="request-add-layer" role="dialog" aria-modal="true" aria-labelledby="request-add-title" onKeyDown={trapFocus}>
    <button className="request-add-backdrop" type="button" onClick={closeConfirmation} aria-label="Закрыть подтверждение" />
    <div ref={dialogRef} className="request-add-confirmation">
      <header><div><span>Добавлено в запрос КП</span><h2 id="request-add-title">Позиция сохранена</h2></div><button type="button" onClick={closeConfirmation} aria-label="Закрыть">×</button></header>
      <section><div className="request-add-media">{media}</div><div><b>{currentItem.title}</b><span>{currentItem.article}</span>{currentItem.shippingLabel && <small>{currentItem.shippingLabel}</small>}</div><div><strong>{currentItem.price || "Цена по запросу"}</strong><span>{currentItem.quantity ?? 1} шт.</span></div></section>
      <p>В запросе: <b>{items.length} поз. · {summary.totalQuantity} шт.</b></p>
      <footer><button ref={continueRef} type="button" onClick={closeConfirmation}>Продолжить выбор</button><button type="button" onClick={open}>Открыть запрос КП</button></footer>
    </div>
  </div>;
}

function RequestCartDrawer() {
  const { items, isOpen, close, updateQuantity, remove } = useRequestCart();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftNumber, setDraftNumber] = useState("");
  const [billingProvided, setBillingProvided] = useState(false);
  const [formError, setFormError] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const successCloseRef = useRef<HTMLButtonElement>(null);
  const idempotencyKeyRef = useRef("");
  const summary = useMemo(() => summarizeRequest(items), [items]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = previousOverflow; returnFocusRef.current?.focus(); };
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen && sent) successCloseRef.current?.focus();
  }, [isOpen, sent]);

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []).filter((element) => element.offsetParent !== null);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function closeDrawer() {
    setSent(false);
    setSubmitting(false);
    setFormError("");
    idempotencyKeyRef.current = "";
    close();
  }

  function changeQuantity(item: RequestItem, quantity: number) {
    updateQuantity(item.id, quantity);
    trackQuote("change_quote_quantity", { placement:"quote_drawer", item_count:items.length });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || submitting) return;
    const formData = new FormData(event.currentTarget);
    const inn = String(formData.get("billing_inn") ?? "").trim();
    const requisitesFile = formData.get("billing_file");
    if (requisitesFile instanceof File && requisitesFile.size > 10 * 1024 * 1024) {
      setFormError("Файл реквизитов больше 10 МБ. Выберите файл меньшего размера или укажите только ИНН.");
      return;
    }
    setFormError("");
    setSubmitting(true);
    trackQuote("submit_quote", { placement:"quote_drawer", item_count:items.length });
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
    formData.set("idempotency_key", idempotencyKeyRef.current);
    formData.set("items", JSON.stringify(items));
    formData.set("source", JSON.stringify(buildRequestSource()));
    try {
      const response = await fetch("/api/quote-requests", { method:"POST", body:formData, headers:{ "X-Requested-With":"7tool-local-preview" } });
      const result = await response.json() as { ok: boolean; requestNumber?: string; billingProvided?: boolean; message?: string };
      if (!response.ok || !result.ok || !result.requestNumber) throw new Error(result.message || "Не удалось сохранить заявку.");
      setDraftNumber(result.requestNumber);
      setBillingProvided(Boolean(result.billingProvided || inn || requisitesFile instanceof File && requisitesFile.size > 0));
      setSubmitting(false);
      setSent(true);
      trackQuote("quote_success", { placement:"quote_drawer", item_count:items.length });
    } catch (error) {
      setSubmitting(false);
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить заявку. Попробуйте ещё раз.");
      trackQuote("quote_error", { placement:"quote_drawer", item_count:items.length });
    }
  }

  if (!isOpen) return null;

  return <div className="request-cart-layer" role="dialog" aria-modal="true" aria-labelledby="request-cart-title" aria-describedby="request-cart-description" onKeyDown={trapFocus}>
    <button className="request-cart-backdrop" type="button" onClick={closeDrawer} aria-label="Закрыть запрос" />
    <aside ref={drawerRef} className="request-cart-drawer">
      <header><div><span>Единый запрос без повторного ввода</span><h2 id="request-cart-title">Запрос коммерческого предложения</h2><p id="request-cart-description">Проверьте позиции и оставьте контакты — комплектность, остаток и срок менеджер подтвердит в ответе.</p></div><button ref={closeButtonRef} type="button" onClick={closeDrawer} aria-label="Закрыть">×</button></header>
      <div className="request-cart-progress" aria-label="Этапы запроса"><b>1 <span>Состав</span></b><b>2 <span>Контакты</span></b><b>3 <span>Ответ менеджера</span></b></div>

      {sent ? <QuoteSuccess draftNumber={draftNumber} itemCount={items.length} totalQuantity={summary.totalQuantity} billingProvided={billingProvided} onEdit={() => { idempotencyKeyRef.current = ""; setSent(false); }} onClose={closeDrawer} closeRef={successCloseRef} /> : <>
        {items.length > 0 ? <section className="request-cart-composition" aria-labelledby="request-cart-composition-title"><div className="request-cart-section-title"><div><span>Состав запроса</span><h3 id="request-cart-composition-title">{items.length} поз. · {summary.totalQuantity} шт.</h3></div>{summary.pricedItems > 0 && <div><span>Ориентировочно</span><b>{formatMoney(summary.estimatedTotal)}</b></div>}</div><div className="request-cart-items">{items.map((item) => <RequestCartItem item={item} onChange={changeQuantity} onRemove={remove} key={item.id} />)}</div><p className="request-cart-estimate-note">{summary.hasUnpricedItems ? "Итог рассчитан только по позициям с указанной ценой. " : ""}Цена, остаток и дата отгрузки будут повторно подтверждены перед оплатой.</p></section> : <div className="request-cart-empty"><b>В запросе пока нет товаров</b><p>Добавьте нужное исполнение со страницы товара или из категории.</p><button type="button" onClick={closeDrawer}>Продолжить подбор</button></div>}

        <form className="request-cart-form" onSubmit={submit}>
          <input className="request-cart-honeypot" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <div className="request-cart-form-heading"><span>Контакты и требования</span><h3>Как связаться по запросу</h3><p>Обязателен только телефон. Остальные данные можно добавить, чтобы ускорить подготовку КП и счёта.</p></div>
          <label>Телефон для связи <span>*</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 999 000-00-00" required /></label>
          <label>Имя <small>необязательно</small><input name="contact_name" type="text" autoComplete="name" maxLength={120} placeholder="Как к вам обращаться" /></label>
          <label>Email для КП <small>необязательно</small><input name="email" type="email" autoComplete="email" placeholder="name@company.ru" /></label>
          <label>Компания<input name="company" type="text" autoComplete="organization" placeholder="Название, необязательно" /></label>
          <label>Город поставки<input name="city" type="text" autoComplete="address-level2" placeholder="Например, Екатеринбург" /></label>
          <details className="request-cart-wide request-cart-requisites"><summary><span>Нужен счёт после подтверждения?</span><small>Добавить реквизиты · необязательно</small></summary><div><p>Укажите ИНН или приложите карточку организации. Остальные поля вручную заполнять не нужно.</p><label>ИНН организации<input name="billing_inn" type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{10}|[0-9]{12}" placeholder="10 или 12 цифр" /></label><span>или</span><label className="request-cart-file">Карточка организации<input name="billing_file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" /><small>PDF, JPG или PNG · до 10 МБ</small></label><strong>Счёт подготовят только после подтверждения цены, наличия, комплектации и даты отгрузки.</strong></div></details>
          <label className="request-cart-wide">Комментарий к закупке<textarea name="comment" rows={4} placeholder="Требуемый срок, условия поставки, режим работы или другие требования" /></label>
          <fieldset className="request-cart-wide request-cart-options"><legend>Что проверить и включить в ответ</legend><label><input name="check_availability" type="checkbox" defaultChecked /> Остаток и ближайшую дату отгрузки</label><label><input name="check_set" type="checkbox" defaultChecked /> Комплектность и совместимость</label><label><input name="check_docs" type="checkbox" defaultChecked /> Паспорт, сертификаты и гарантию</label></fieldset>
          <label className="request-cart-wide request-cart-check"><input name="alternatives" type="checkbox" defaultChecked /> Можно предложить подходящий аналог, если он выгоднее или доступен раньше</label>
          <label className="request-cart-wide request-cart-check"><input name="consent" type="checkbox" defaultChecked required /> <span>Я согласен с <a href="/soglasie-na-obrabotku" target="_blank">обработкой персональных данных</a></span></label>
          {formError && <div className="request-cart-wide request-cart-form-error" role="alert">{formError}</div>}
          <div className="request-cart-wide request-cart-submit"><button type="submit" disabled={!items.length || submitting}>{submitting ? "Надёжно сохраняем…" : "Сохранить запрос КП"}</button><small>Сначала надёжно сохраним заявку и присвоим номер. Менеджер проверит состав и условия поставки.</small></div>
        </form>
        <ManagerContactCard compact placement="quote_drawer" />
      </>}
    </aside>
  </div>;
}

function RequestCartItem({ item, onChange, onRemove }: { item: RequestItem; onChange: (item: RequestItem, quantity: number) => void; onRemove: (id: string) => void }) {
  const quantity = item.quantity ?? 1;
  const unitPrice = parseQuotePrice(item.price);
  const media = item.image ? <Image src={item.image} alt="" width={84} height={84} unoptimized /> : <span aria-hidden="true">7T</span>;
  return <article><div className="request-cart-item-media">{item.href ? <a href={item.href} tabIndex={-1} aria-hidden="true">{media}</a> : media}</div><div className="request-cart-item-copy"><b>{item.href ? <a href={item.href} aria-label={`Открыть товар: ${item.title}`}>{item.title}</a> : item.title}</b><span>{item.article}</span>{item.price && <small>{item.price} · с НДС</small>}{item.shippingLabel && <span className={item.shippingLabel.startsWith("В наличии") ? "request-cart-shipping request-cart-shipping--available" : "request-cart-shipping"}>{item.shippingLabel}</span>}{item.shippingDetail && <small className="request-cart-shipping-detail">{item.shippingDetail}</small>}</div><div className="request-cart-item-actions"><span>Количество</span><div className="request-cart-quantity"><button type="button" aria-label={`Уменьшить количество ${item.title}`} onClick={() => onChange(item, Math.max(1, quantity - 1))}>−</button><input aria-label={`Количество ${item.title}`} type="number" min="1" max="999" value={quantity} onChange={(event) => onChange(item, Number(event.target.value) || 1)} /><button type="button" aria-label={`Увеличить количество ${item.title}`} onClick={() => onChange(item, quantity + 1)}>+</button></div>{unitPrice !== null && <b>{formatMoney(unitPrice * quantity)}</b>}</div><button className="request-cart-remove" type="button" onClick={() => onRemove(item.id)} aria-label={`Удалить ${item.title}`}>Удалить</button></article>;
}

function QuoteSuccess({ draftNumber, itemCount, totalQuantity, billingProvided, onEdit, onClose, closeRef }: { draftNumber: string; itemCount: number; totalQuantity: number; billingProvided: boolean; onEdit: () => void; onClose: () => void; closeRef: RefObject<HTMLButtonElement | null> }) {
  return <section className="request-cart-success" role="status"><span>Заявка надёжно сохранена</span><h3>Запрос {draftNumber}</h3><p>{itemCount} поз. · {totalQuantity} шт. Состав, контакты и требования записаны до показа этого подтверждения.</p>{billingProvided && <div className="request-cart-billing-status"><b>Реквизиты добавлены</b><p>Менеджер проверит их и подготовит счёт только после подтверждения условий поставки.</p></div>}<div><b>Что произойдёт дальше</b><ol><li>Менеджер проверит наличие и ближайшую дату отгрузки.</li><li>Уточнит совместимость, комплектность и документы.</li><li>Подготовит ответ или коммерческое предложение.</li></ol></div><strong>Сохраните номер заявки — по нему можно уточнить статус.</strong><footer><Link href="/contacts">Контакты 7TOOL</Link><button type="button" onClick={onEdit}>Изменить запрос</button><button ref={closeRef} type="button" onClick={onClose}>Вернуться к товарам</button></footer></section>;
}

function formatMoney(value: number): string { return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`; }
function trackQuote(event: string, detail: Record<string, string | number | undefined>) { window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, page_type:"quote_request", ...detail } })); }
function isCartShippingPromise(value: unknown): value is { label: string; detail: string } {
  if (!value || typeof value !== "object") return false;
  const promise = value as { label?: unknown; detail?: unknown };
  return typeof promise.label === "string" && promise.label.length <= 160 && typeof promise.detail === "string" && promise.detail.length <= 160;
}
