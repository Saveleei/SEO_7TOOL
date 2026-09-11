"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

export function ContactRequestDialog({ categoryTitle }: { categoryTitle: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = "hidden";
    phoneRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
      triggerElement?.focus();
    };
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  return <>
    <button ref={triggerRef} className="contact-dialog-trigger" type="button" onClick={() => { setSent(false); setOpen(true); }}>Отправить параметры →</button>
    {open && <div className="contact-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="contact-dialog-title" aria-describedby="contact-dialog-description">
      <button className="contact-dialog-backdrop" type="button" aria-label="Закрыть форму" onClick={() => setOpen(false)} />
      <section className="contact-dialog-panel">
        <header><div><span>Обратная связь</span><h2 id="contact-dialog-title">Передать задачу инженеру</h2><p id="contact-dialog-description">Опишите известные параметры. Артикул и точную модель указывать не обязательно.</p></div><button type="button" aria-label="Закрыть" onClick={() => setOpen(false)}>×</button></header>
        {sent ? <div className="contact-dialog-success" role="status"><span>Тестовый режим</span><b>Форма подготовлена правильно</b><p>В рабочей версии заявка получит номер, а менеджер свяжется по указанному телефону. Сейчас данные никуда не отправлены.</p><button type="button" onClick={() => setOpen(false)}>Закрыть</button></div> : <form onSubmit={submit}>
          <div className="test-form-mark">Тестовая форма · ничего не отправляет</div>
          <label>Телефон для связи <span>*</span><input ref={phoneRef} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 999 000-00-00" required /></label>
          <label>Как к вам обращаться<input name="name" type="text" autoComplete="name" placeholder="Имя, необязательно" /></label>
          <label className="contact-dialog-wide">Что требуется<textarea name="task" rows={4} defaultValue={`Нужен подбор: ${categoryTitle}. `} required /></label>
          <label className="contact-dialog-wide contact-dialog-check"><input name="consent" type="checkbox" defaultChecked required /> Я согласен на обработку персональных данных</label>
          <div className="contact-dialog-actions"><button type="submit">Отправить задачу</button><small>Менеджер позвонит по указанному номеру в рабочее время.</small></div>
        </form>}
      </section>
    </div>}
  </>;
}
