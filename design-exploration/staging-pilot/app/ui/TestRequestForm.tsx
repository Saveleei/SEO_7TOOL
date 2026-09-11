"use client";

import { FormEvent, useState } from "react";

export function TestRequestForm({ compact = false, context = "Опишите оборудование, параметры или вставьте позиции из спецификации.", buttonLabel, primaryContact = "email" }: { compact?: boolean; context?: string; buttonLabel?: string; primaryContact?: "email" | "phone" }) {
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <form className={compact ? "request-form request-form-compact" : "request-form"} onSubmit={submit}>
      <div className="test-form-mark">Тестовая форма · ничего не отправляет</div>
      {primaryContact === "phone" ? <label>Телефон для связи<input type="tel" autoComplete="tel" placeholder="+7 999 000-00-00" required /></label> : <label>Рабочая почта<input type="email" autoComplete="email" placeholder="name@company.ru" required /></label>}
      {!compact && primaryContact !== "phone" && <label>Телефон<input type="tel" autoComplete="tel" placeholder="+7 999 000-00-00" /></label>}
      <label>Что требуется<textarea rows={compact ? 3 : 4} defaultValue={context} /></label>
      <label className="request-form-check"><input type="checkbox" defaultChecked required /> Я согласен на обработку персональных данных</label>
      <button type="submit">{buttonLabel ?? (compact ? "Подготовить запрос КП" : "Создать тестовую заявку")}</button>
      {sent && <p className="form-success" role="status">Готово для демонстрации. Данные никуда не отправлены.</p>}
      {primaryContact === "phone" ? <small>Менеджер свяжется по указанному телефону в рабочее время.</small> : <small>Для реального запроса: <a href="mailto:info@7tool.ru">info@7tool.ru</a></small>}
    </form>
  );
}
