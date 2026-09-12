"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createDraftNumber, parseQuotePrice, sanitizeRequestItems, summarizeRequest } from "../data/requestQuote.mjs";
import { ManagerContactCard } from "./ManagerContactCard";

export type RequestItem = {
  id: string;
  title: string;
  article: string;
  price?: string;
  quantity?: number;
  image?: string;
  href?: string;
};

type RequestCartValue = {
  items: RequestItem[];
  addItem: (item: RequestItem) => void;
  open: () => void;
  close: () => void;
  updateQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  isOpen: boolean;
};

const STORAGE_KEY = "7tool:quote-draft:v1";
const RequestCartContext = createContext<RequestCartValue | null>(null);

export function RequestCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
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

  function addItem(item: RequestItem) {
    setItems((current) => {
      const existing = current.find((currentItem) => currentItem.id === item.id);
      return existing
        ? current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, ...item, quantity:Math.min(999, (currentItem.quantity ?? 1) + (item.quantity ?? 1)) } : currentItem)
        : [...current, { ...item, quantity:item.quantity ?? 1 }];
    });
    trackQuote("add_to_quote", { placement:"product_action" });
  }

  function updateQuantity(id: string, quantity: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, quantity:Math.min(999, Math.max(1, quantity)) } : item));
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    trackQuote("remove_from_quote", { placement:"quote_drawer" });
  }

  function open() {
    setIsOpen(true);
    trackQuote("open_quote", { placement:"quote_trigger", item_count:items.length });
  }

  const close = useCallback(() => setIsOpen(false), []);
  const value = { items, isOpen, addItem, open, close, updateQuantity, remove };
  return <RequestCartContext.Provider value={value}>{children}<RequestCartDock /><RequestCartDrawer /></RequestCartContext.Provider>;
}

export function useRequestCart(): RequestCartValue {
  const value = useContext(RequestCartContext);
  if (!value) throw new Error("useRequestCart must be used within RequestCartProvider");
  return value;
}

export function RequestCartButton({ compact = false }: { compact?: boolean }) {
  const { items, open } = useRequestCart();
  const { totalQuantity } = summarizeRequest(items);
  return <button className={compact ? "request-cart-trigger request-cart-trigger--compact" : "request-cart-trigger"} type="button" onClick={open} aria-label={`Открыть запрос КП, позиций: ${items.length}, единиц: ${totalQuantity}`}><span>{compact ? "КП" : "Запрос КП"}</span>{items.length > 0 && <b>{items.length}</b>}</button>;
}

export function AddRequestButton({ item, className, children }: { item: RequestItem; className?: string; children?: ReactNode }) {
  const { items, addItem } = useRequestCart();
  const added = items.some((current) => current.id === item.id);
  return <button className={className} type="button" onClick={() => addItem(item)}>{children ?? (added ? "Добавить ещё" : "В запрос")}</button>;
}

function RequestCartDock() {
  const { items, isOpen, open } = useRequestCart();
  const { totalQuantity } = summarizeRequest(items);
  if (items.length === 0 || isOpen) return null;
  return <div className="request-cart-dock" role="status" aria-live="polite"><div><span>Черновик КП</span><b>{items.length} поз. · {totalQuantity} шт.</b></div><button type="button" onClick={open}>Проверить запрос</button></div>;
}

function RequestCartDrawer() {
  const { items, isOpen, close, updateQuantity, remove } = useRequestCart();
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftNumber, setDraftNumber] = useState("");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const summary = useMemo(() => summarizeRequest(items), [items]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => { window.removeEventListener("keydown", closeOnEscape); document.body.style.overflow = previousOverflow; };
  }, [isOpen, close]);

  function closeDrawer() {
    setSent(false);
    setSubmitting(false);
    close();
  }

  function changeQuantity(item: RequestItem, quantity: number) {
    updateQuantity(item.id, quantity);
    trackQuote("change_quote_quantity", { placement:"quote_drawer", item_count:items.length });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || submitting) return;
    setSubmitting(true);
    trackQuote("submit_quote", { placement:"quote_drawer", item_count:items.length });
    window.setTimeout(() => {
      setDraftNumber(createDraftNumber());
      setSubmitting(false);
      setSent(true);
      trackQuote("quote_success", { placement:"quote_drawer", item_count:items.length });
    }, 450);
  }

  if (!isOpen) return null;

  return <div className="request-cart-layer" role="dialog" aria-modal="true" aria-labelledby="request-cart-title" aria-describedby="request-cart-description">
    <button className="request-cart-backdrop" type="button" onClick={closeDrawer} aria-label="Закрыть запрос" />
    <aside className="request-cart-drawer">
      <header><div><span>Единый запрос без повторного ввода</span><h2 id="request-cart-title">Запрос коммерческого предложения</h2><p id="request-cart-description">Проверьте позиции и оставьте контакты — комплектность, остаток и срок менеджер подтвердит в ответе.</p></div><button ref={closeButtonRef} type="button" onClick={closeDrawer} aria-label="Закрыть">×</button></header>
      <div className="request-cart-progress" aria-label="Этапы запроса"><b>1 <span>Состав</span></b><b>2 <span>Контакты</span></b><b>3 <span>Ответ менеджера</span></b></div>

      {sent ? <QuoteSuccess draftNumber={draftNumber} itemCount={items.length} totalQuantity={summary.totalQuantity} onEdit={() => setSent(false)} onClose={closeDrawer} /> : <>
        {items.length > 0 ? <section className="request-cart-composition" aria-labelledby="request-cart-composition-title"><div className="request-cart-section-title"><div><span>Состав запроса</span><h3 id="request-cart-composition-title">{items.length} поз. · {summary.totalQuantity} шт.</h3></div>{summary.pricedItems > 0 && <div><span>Ориентировочно</span><b>{formatMoney(summary.estimatedTotal)}</b></div>}</div><div className="request-cart-items">{items.map((item) => <RequestCartItem item={item} onChange={changeQuantity} onRemove={remove} key={item.id} />)}</div><p className="request-cart-estimate-note">{summary.hasUnpricedItems ? "Итог рассчитан только по позициям с указанной ценой. " : ""}Цена, остаток и дата отгрузки будут повторно подтверждены перед оплатой.</p></section> : <div className="request-cart-empty"><b>В запросе пока нет товаров</b><p>Добавьте нужное исполнение со страницы товара или из категории.</p><button type="button" onClick={closeDrawer}>Продолжить подбор</button></div>}

        <form className="request-cart-form" onSubmit={submit}>
          <div className="request-cart-form-heading"><span>Контакты и требования</span><h3>Куда отправить КП</h3><p>Поля со звёздочкой нужны, чтобы менеджер мог уточнить задачу и вернуть предложение.</p></div>
          <label>Email для КП <span>*</span><input name="email" type="email" autoComplete="email" placeholder="name@company.ru" required /></label>
          <label>Телефон для уточнения <span>*</span><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 999 000-00-00" required /></label>
          <label>Компания<input name="company" type="text" autoComplete="organization" placeholder="Название, необязательно" /></label>
          <label>Город поставки<input name="city" type="text" autoComplete="address-level2" placeholder="Например, Екатеринбург" /></label>
          <label className="request-cart-wide">Комментарий к закупке<textarea name="comment" rows={4} placeholder="Требуемый срок, условия поставки, режим работы или другие требования" /></label>
          <fieldset className="request-cart-wide request-cart-options"><legend>Что проверить и включить в ответ</legend><label><input name="check_availability" type="checkbox" defaultChecked /> Остаток и ближайшую дату отгрузки</label><label><input name="check_set" type="checkbox" defaultChecked /> Комплектность и совместимость</label><label><input name="check_docs" type="checkbox" defaultChecked /> Паспорт, сертификаты и гарантию</label></fieldset>
          <label className="request-cart-wide request-cart-check"><input name="alternatives" type="checkbox" defaultChecked /> Можно предложить подходящий аналог, если он выгоднее или доступен раньше</label>
          <label className="request-cart-wide request-cart-check"><input name="consent" type="checkbox" defaultChecked required /> Я согласен на обработку персональных данных</label>
          <div className="request-cart-wide request-cart-submit"><button type="submit" disabled={!items.length || submitting}>{submitting ? "Формируем черновик…" : "Сформировать запрос КП"}</button><small>Тестовый стенд: контактные данные и заявка никуда не отправляются.</small></div>
        </form>
        <ManagerContactCard compact placement="quote_drawer" />
      </>}
    </aside>
  </div>;
}

function RequestCartItem({ item, onChange, onRemove }: { item: RequestItem; onChange: (item: RequestItem, quantity: number) => void; onRemove: (id: string) => void }) {
  const quantity = item.quantity ?? 1;
  const unitPrice = parseQuotePrice(item.price);
  return <article><div className="request-cart-item-media">{item.image ? <Image src={item.image} alt="" width={84} height={84} unoptimized /> : <span aria-hidden="true">7T</span>}</div><div className="request-cart-item-copy"><b>{item.href ? <Link href={item.href}>{item.title}</Link> : item.title}</b><span>{item.article}</span>{item.price && <small>{item.price} · с НДС</small>}</div><div className="request-cart-item-actions"><span>Количество</span><div className="request-cart-quantity"><button type="button" aria-label={`Уменьшить количество ${item.title}`} onClick={() => onChange(item, Math.max(1, quantity - 1))}>−</button><input aria-label={`Количество ${item.title}`} type="number" min="1" max="999" value={quantity} onChange={(event) => onChange(item, Number(event.target.value) || 1)} /><button type="button" aria-label={`Увеличить количество ${item.title}`} onClick={() => onChange(item, quantity + 1)}>+</button></div>{unitPrice !== null && <b>{formatMoney(unitPrice * quantity)}</b>}</div><button className="request-cart-remove" type="button" onClick={() => onRemove(item.id)} aria-label={`Удалить ${item.title}`}>Удалить</button></article>;
}

function QuoteSuccess({ draftNumber, itemCount, totalQuantity, onEdit, onClose }: { draftNumber: string; itemCount: number; totalQuantity: number; onEdit: () => void; onClose: () => void }) {
  return <section className="request-cart-success" role="status"><span>Черновик сформирован</span><h3>Запрос {draftNumber}</h3><p>{itemCount} поз. · {totalQuantity} шт. Все товары, количества и требования сохранены в этом окне.</p><div><b>Что произойдёт в рабочей версии</b><ol><li>Заявка получит постоянный номер.</li><li>Менеджер проверит остаток, совместимость и документы.</li><li>КП будет отправлено на указанный email, а детали уточнят по телефону.</li></ol></div><strong>Сейчас ничего не отправлено наружу — это безопасный тестовый результат.</strong><footer><button type="button" onClick={onEdit}>Изменить запрос</button><button type="button" onClick={onClose}>Вернуться к товарам</button></footer></section>;
}

function formatMoney(value: number): string { return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`; }
function trackQuote(event: string, detail: Record<string, string | number>) { window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, page_type:"quote_request", ...detail } })); }
