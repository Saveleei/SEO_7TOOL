"use client";

import { createContext, FormEvent, ReactNode, useContext, useMemo, useState } from "react";

export type RequestItem = {
  id: string;
  title: string;
  article: string;
  price?: string;
  quantity?: number;
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

const RequestCartContext = createContext<RequestCartValue | null>(null);

export function RequestCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  function addItem(item: RequestItem) {
    setItems((current) => {
      const existing = current.find((currentItem) => currentItem.id === item.id);
      return existing
        ? current.map((currentItem) => currentItem.id === item.id ? { ...currentItem, quantity: (currentItem.quantity ?? 1) + (item.quantity ?? 1) } : currentItem)
        : [...current, { ...item, quantity: item.quantity ?? 1 }];
    });
  }

  function updateQuantity(id: string, quantity: number) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item));
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  const value = { items, isOpen, addItem, open:() => setIsOpen(true), close:() => setIsOpen(false), updateQuantity, remove };
  return <RequestCartContext.Provider value={value}>{children}<RequestCartDock /><RequestCartDrawer /></RequestCartContext.Provider>;
}

export function useRequestCart(): RequestCartValue {
  const value = useContext(RequestCartContext);
  if (!value) throw new Error("useRequestCart must be used within RequestCartProvider");
  return value;
}

export function RequestCartButton({ compact = false }: { compact?: boolean }) {
  const { items, open } = useRequestCart();
  const count = items.reduce((total, item) => total + (item.quantity ?? 1), 0);
  return <button className={compact ? "request-cart-trigger request-cart-trigger--compact" : "request-cart-trigger"} type="button" onClick={open} aria-label={`Открыть запрос КП, позиций: ${count}`}><span>{compact ? "КП" : "Запрос КП"}</span>{count > 0 && <b>{count}</b>}</button>;
}

export function AddRequestButton({ item, className, children }: { item: RequestItem; className?: string; children?: ReactNode }) {
  const { items, addItem } = useRequestCart();
  const added = items.some((current) => current.id === item.id);
  return <button className={className} type="button" onClick={() => addItem(item)}>{children ?? (added ? "Добавить ещё" : "В запрос")}</button>;
}

function RequestCartDock() {
  const { items, isOpen, open } = useRequestCart();
  const totalQuantity = items.reduce((total, item) => total + (item.quantity ?? 1), 0);
  if (items.length === 0 || isOpen) return null;

  return <div className="request-cart-dock" role="status" aria-live="polite">
    <div><span>Черновик КП сохранён</span><b>{items.length} поз. · {totalQuantity} шт.</b></div>
    <button type="button" onClick={open}>Открыть запрос</button>
  </div>;
}

function RequestCartDrawer() {
  const { items, isOpen, close, updateQuantity, remove } = useRequestCart();
  const [sent, setSent] = useState(false);
  const totalQuantity = useMemo(() => items.reduce((total, item) => total + (item.quantity ?? 1), 0), [items]);

  function closeDrawer() {
    setSent(false);
    close();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  if (!isOpen) return null;

  return <div className="request-cart-layer" role="dialog" aria-modal="true" aria-labelledby="request-cart-title">
    <button className="request-cart-backdrop" type="button" onClick={closeDrawer} aria-label="Закрыть запрос" />
    <aside className="request-cart-drawer">
      <header><div><span>Черновик закупки</span><h2 id="request-cart-title">Запрос КП</h2><p>{items.length ? `${items.length} поз. · ${totalQuantity} шт.` : "Пока без товаров"}</p></div><button type="button" onClick={closeDrawer} aria-label="Закрыть">×</button></header>
      {items.length > 0 ? <div className="request-cart-items">{items.map((item) => <article key={item.id}><div><b>{item.title}</b><span>{item.article}</span>{item.price && <small>{item.price} · с НДС</small>}</div><label>Количество<input type="number" min="1" value={item.quantity ?? 1} onChange={(event) => updateQuantity(item.id, Number(event.target.value))} /></label><button type="button" onClick={() => remove(item.id)} aria-label={`Удалить ${item.title}`}>Удалить</button></article>)}</div> : <div className="request-cart-empty"><b>Добавьте оборудование или оснастку</b><p>Товары, количество и комментарии соберутся в одном запросе.</p></div>}
      <form className="request-cart-form" onSubmit={submit}>
        <label>Рабочая почта<input type="email" placeholder="name@company.ru" required /></label>
        <label>Компания<input type="text" placeholder="Название организации" /></label>
        <label>Комментарий<textarea rows={3} placeholder="Срок, город, особые требования" /></label>
        <label className="request-cart-check"><input type="checkbox" /> Можно предложить аналоги</label>
        <label className="request-cart-check"><input type="checkbox" defaultChecked required /> Согласен на обработку персональных данных</label>
        <button type="submit" disabled={!items.length}>Создать тестовую заявку</button>
        <small>Прототип сохраняет запрос только на экране и ничего не отправляет.</small>
        {sent && <div className="request-cart-success" role="status"><b>Заявка 7T-DEMO-014 сформирована</b><span>В рабочей версии здесь появятся номер, копия на email и статус ответа менеджера.</span></div>}
      </form>
    </aside>
  </div>;
}
