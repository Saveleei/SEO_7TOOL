const FALLBACK_SITE_URL = "https://7tool.ru";

function normalizeSiteUrl(value: string | undefined): string {
  const raw = (value || FALLBACK_SITE_URL).trim();
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`.replace(/\/+$/, "");
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export function absoluteUrl(pathname = "/"): string {
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export const company = {
  name: "7TOOL",
  legalName: "ООО «7TOOL»",
  email: "info@7tool.ru",
  phone: "+7 (962) 611-24-19",
  primaryPhone: "+7 (962) 611-24-19",
  additionalPhones: [
    "+7 (999) 121-62-86",
    "+7 (8352) 60-64-22",
    "+7 (8482) 712-419",
  ],
  address: "Москва, Рябиновая улица, 63, стр. 4",
  hours: "Пн–Пт 9:00–19:00 МСК",
} as const;

// Карточка менеджера и её коммерческий смысл зафиксированы владельцем.
export const manager = {
  name: "Евгений Савельев",
  role: "Специалист отдела сварочного оборудования",
  phone: company.primaryPhone,
  maxUrl: "https://max.ru/u/f9LHodD0cOJKwt-kjzgvpW6TLCZbS3ML8WWdL8lPJjF2ceK2seLyXaNOl8w",
  telegram: "saveleei",
  email: company.email,
  photo: "/manager.jpg",
  hours: company.hours,
  promise: "Отвечаю в среднем за 12 минут — подберу аналог и согласую сроки.",
} as const;

export function phoneHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `tel:${digits.startsWith("7") ? `+${digits}` : digits}`;
}
