export const siteContact = {
  managerName: "Евгений Савельев",
  managerRole: "Специалист отдела сварочного оборудования",
  phone: "+7 (962) 611-24-19",
  phoneHref: "tel:+79626112419",
  email: "info@7tool.ru",
  telegramUrl: "https://t.me/saveleei",
  maxUrl: "https://max.ru/u/f9LHodD0cOJKwt-kjzgvpW6TLCZbS3ML8WWdL8lPJjF2ceK2seLyXaNOl8w",
  photo: "/people/manager.jpg",
} as const;

export const siteCompany = {
  brandName: "7TOOL",
  legalName: "ООО «7TOOL»",
  address: "Москва, Рябиновая улица, 63, стр. 4",
  hours: "Пн–Пт 9:00–19:00 МСК",
  website: "7tool.ru",
} as const;

export const telegramUrl = siteContact.telegramUrl;
export const maxUrl = siteContact.maxUrl;
