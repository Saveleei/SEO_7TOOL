"use client";

import { FormEvent, useState } from "react";

export function TestRequestForm({ compact = false, context = "Опишите оборудование, параметры или вставьте позиции из спецификации.", buttonLabel }: { compact?: boolean; context?: string; buttonLabel?: string }) {
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <form className={compact ? "request-form request-form-compact" : "request-form"} onSubmit={submit}>
      <div className="test-form-mark">Тестовая форма · ничего не отправляет</div>
      <label>Рабочая почта<input type="email" placeholder="name@company.ru" required /></label>
      {!compact && <label>Телефон<input type="tel" placeholder="+7 999 000-00-00" /></label>}
      <label>Что требуется<textarea rows={compact ? 3 : 4} defaultValue={context} /></label>
      <label className="request-form-check"><input type="checkbox" defaultChecked required /> Я согласен на обработку персональных данных</label>
      <button type="submit">{buttonLabel ?? (compact ? "Подготовить запрос КП" : "Создать тестовую заявку")}</button>
      {sent && <p className="form-success" role="status">Готово для демонстрации. Данные никуда не отправлены.</p>}
      <small>Для реального запроса: <a href="mailto:info@7tool.ru">info@7tool.ru</a></small>
    </form>
  );
}
