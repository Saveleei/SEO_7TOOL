"use client";

import { useState } from "react";
import type { ShippingSettings } from "../data/shippingSettingsStore";

type RuntimeDiagnostic = {
  completedAt: string;
  ageMinutes: number | null;
  fresh: boolean;
  reason: "missing" | "future" | "fresh" | "stale";
};

const weekDays = [
  { value:1, short:"Пн", full:"понедельник" },
  { value:2, short:"Вт", full:"вторник" },
  { value:3, short:"Ср", full:"среда" },
  { value:4, short:"Чт", full:"четверг" },
  { value:5, short:"Пт", full:"пятница" },
  { value:6, short:"Сб", full:"суббота" },
  { value:0, short:"Вс", full:"воскресенье" },
];

export function ShippingSettingsForm({ initial, initialDiagnostic }: { initial: ShippingSettings; initialDiagnostic: RuntimeDiagnostic }) {
  const [settings, setSettings] = useState(initial);
  const [diagnostic, setDiagnostic] = useState(initialDiagnostic);
  const [holidaysText, setHolidaysText] = useState(initial.holidays.join("\n"));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function toggleWorkingDay(value: number) {
    setSettings((current) => ({
      ...current,
      workingDays:current.workingDays.includes(value)
        ? current.workingDays.filter((day) => day !== value)
        : [...current.workingDays, value].sort((a, b) => a - b),
    }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    const holidays = Array.from(new Set(holidaysText.split(/[\s,;]+/u).map((value) => value.trim()).filter(Boolean))).sort();
    try {
      const response = await fetch("/api/shipping-settings", {
        method:"PUT",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ ...settings, holidays }),
      });
      const result = await response.json() as { ok?: boolean; message?: string; settings?: ShippingSettings; diagnostic?: RuntimeDiagnostic };
      if (!response.ok || !result.ok || !result.settings) throw new Error(result.message || "Настройки не сохранены.");
      setSettings(result.settings);
      setHolidaysText(result.settings.holidays.join("\n"));
      if (result.diagnostic) setDiagnostic(result.diagnostic);
      setMessage(`Настройки сохранены. Версия ${result.settings.revision}. Новое правило уже применяется сервером.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Настройки не сохранены.");
    } finally {
      setPending(false);
    }
  }

  const policyActive = settings.todayShippingEnabled && diagnostic.fresh;
  return <form className="shipping-settings-layout" onSubmit={save}>
    <div className="shipping-settings-main">
      <section className="shipping-settings-card"><header><span>01</span><div><h2>Аварийный выключатель</h2><p>Мгновенно убирает обещание быстрой отгрузки со всех покупательских экранов.</p></div></header><div className="shipping-settings-body">
        <label className="shipping-emergency-switch"><input type="checkbox" checked={!settings.todayShippingEnabled} onChange={(event) => setSettings((current) => ({ ...current, todayShippingEnabled:!event.target.checked }))} /><span><b>Не обещать быструю отгрузку</b><small>Используйте при сбое склада, интеграции или в период инвентаризации.</small></span></label>
      </div></section>

      <section className="shipping-settings-card"><header><span>02</span><div><h2>Cutoff и рабочая неделя</h2><p>До указанного часа в рабочий день показывается «Отгрузка сегодня».</p></div></header><div className="shipping-settings-body shipping-policy-grid">
        <label><span>Принимаем на отгрузку сегодня до</span><div className="shipping-hour-field"><input type="number" min={0} max={23} value={settings.cutoffHour} onChange={(event) => setSettings((current) => ({ ...current, cutoffHour:Number(event.target.value) }))} /><b>:00 МСК</b></div><small>18 означает: до 17:59 включительно.</small></label>
        <label><span>Допустимый возраст остатков</span><div className="shipping-hour-field"><input type="number" min={15} max={1440} step={15} value={settings.maxSnapshotAgeMinutes} onChange={(event) => setSettings((current) => ({ ...current, maxSnapshotAgeMinutes:Number(event.target.value) }))} /><b>мин.</b></div><small>Если данные старше, обещание автоматически исчезает.</small></label>
        <fieldset className="shipping-week"><legend>Рабочие дни</legend><div>{weekDays.map((day) => <label key={day.value} title={day.full}><input type="checkbox" checked={settings.workingDays.includes(day.value)} onChange={() => toggleWorkingDay(day.value)} /><span>{day.short}</span></label>)}</div></fieldset>
      </div></section>

      <section className="shipping-settings-card"><header><span>03</span><div><h2>Исключения календаря</h2><p>Праздники, инвентаризация и другие даты без отгрузки.</p></div></header><div className="shipping-settings-body"><label className="shipping-holidays"><span>Нерабочие даты — по одной в строке</span><textarea rows={6} value={holidaysText} onChange={(event) => setHolidaysText(event.target.value)} placeholder={"2026-11-04\n2027-01-01"} /><small>Формат: ГГГГ-ММ-ДД. Выходные из рабочей недели добавлять не нужно.</small></label></div></section>

      <section className="shipping-settings-card shipping-feed-health"><header><span>04</span><div><h2>Свежесть каталога</h2><p>Проверяется автоматически и не может быть подтверждена вручную.</p></div></header><div className="shipping-settings-body"><dl><div><dt>Время снимка</dt><dd>{diagnostic.completedAt ? formatDateTime(diagnostic.completedAt) : "Не записано"}</dd></div><div><dt>Возраст</dt><dd>{diagnostic.ageMinutes == null ? "Неизвестен" : formatAge(diagnostic.ageMinutes)}</dd></div><div><dt>Проверка</dt><dd className={diagnostic.fresh ? "is-ok" : "is-blocked"}>{diagnosticLabel(diagnostic.reason)}</dd></div></dl><p>После успешного обновления фида сервер записывает отметку рядом со снимком каталога. Ошибка или отсутствие отметки блокирует обещание «сегодня».</p></div></section>
    </div>

    <aside className="shipping-settings-summary"><span>Действующий режим</span><h2 className={policyActive ? "is-ok" : "is-blocked"}>{policyActive ? "Быстрая отгрузка разрешена" : "Обещание отключено"}</h2><p>{!settings.todayShippingEnabled ? "Отключено администратором." : !diagnostic.fresh ? "Нет подтверждения свежести остатков." : `До ${String(settings.cutoffHour).padStart(2, "0")}:00 МСК в рабочие дни.`}</p><dl><div><dt>Cutoff</dt><dd>{String(settings.cutoffHour).padStart(2, "0")}:00 МСК</dd></div><div><dt>Рабочих дней</dt><dd>{settings.workingDays.length}</dd></div><div><dt>Исключений</dt><dd>{holidaysText.split(/[\s,;]+/u).filter(Boolean).length}</dd></div><div><dt>Версия</dt><dd>{settings.revision}</dd></div></dl><button type="submit" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить и применить"}</button><div className="quote-settings-feedback" aria-live="polite">{error ? <p className="error">{error}</p> : message ? <p className="success">{message}</p> : null}</div><small>Бренд товара не считается поставщиком. Индивидуальные правила поставщиков появятся только после передачи supplier_id в фиде.</small></aside>
  </form>;
}

function diagnosticLabel(reason: RuntimeDiagnostic["reason"]): string {
  if (reason === "fresh") return "Данные свежие";
  if (reason === "stale") return "Данные просрочены";
  if (reason === "future") return "Ошибка времени снимка";
  return "Нет отметки обновления";
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Некорректная дата" : new Intl.DateTimeFormat("ru-RU", { dateStyle:"medium", timeStyle:"short", timeZone:"Europe/Moscow" }).format(date);
}

function formatAge(minutes: number): string {
  if (minutes < 0) return "в будущем";
  if (minutes < 60) return `${minutes} мин.`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ч ${minutes % 60} мин.`;
}
