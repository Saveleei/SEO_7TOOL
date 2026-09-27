export const MAX_SHIPPING_SNAPSHOT_AGE_MINUTES = 26 * 60;

export const DEFAULT_SHIPPING_SETTINGS = Object.freeze({
  revision:0,
  todayShippingEnabled:true,
  cutoffHour:18,
  workingDays:Object.freeze([1, 2, 3, 4, 5]),
  holidays:Object.freeze([]),
  maxSnapshotAgeMinutes:180,
});

export function validateShippingSettings(input) {
  const revision = integer(input?.revision, 0, Number.MAX_SAFE_INTEGER);
  if (revision == null) return fail("Обновите страницу настроек и повторите сохранение.");
  const cutoffHour = integer(input?.cutoffHour, 0, 23);
  if (cutoffHour == null) return fail("Укажите час окончания приёма заказов от 0 до 23.");
  const maxSnapshotAgeMinutes = integer(input?.maxSnapshotAgeMinutes, 15, MAX_SHIPPING_SNAPSHOT_AGE_MINUTES);
  if (maxSnapshotAgeMinutes == null) return fail("Допустимый возраст данных должен быть от 15 минут до 26 часов.");
  if (!Array.isArray(input?.workingDays)) return fail("Выберите рабочие дни.");
  const workingDays = Array.from(new Set(input.workingDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a, b) => a - b);
  if (workingDays.length === 0) return fail("Выберите хотя бы один рабочий день.");
  if (!Array.isArray(input?.holidays) || input.holidays.length > 120) return fail("Проверьте список нерабочих дат.");
  const holidays = Array.from(new Set(input.holidays.map((value) => String(value || "").trim()).filter(Boolean))).sort();
  if (holidays.some((value) => !/^\d{4}-\d{2}-\d{2}$/u.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)))) return fail("Нерабочие даты должны быть в формате ГГГГ-ММ-ДД.");
  return {
    ok:true,
    value:{
      revision,
      todayShippingEnabled:input?.todayShippingEnabled === true,
      cutoffHour,
      workingDays,
      holidays,
      maxSnapshotAgeMinutes,
    },
  };
}

function integer(value, min, max) {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : null;
}

function fail(message) {
  return { ok:false, message };
}
