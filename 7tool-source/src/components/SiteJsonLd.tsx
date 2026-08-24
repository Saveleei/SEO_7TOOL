import { absoluteUrl, company, manager, SITE_URL } from "@/lib/site-config";
import { buildOrganizationStructuredData, buildWebsiteStructuredData } from "@/lib/structured-data";
import { StructuredData } from "./StructuredData";

export function SiteJsonLd() {
  const organization = buildOrganizationStructuredData({
    id: `${SITE_URL}/#organization`,
    name: "7TOOL",
    legalName: company.legalName,
    url: SITE_URL,
    logo: absoluteUrl("/icon.svg"),
    image: absoluteUrl("/og.png"),
    email: company.email,
    telephone: manager.phone,
    description:
      "Промышленный инструмент и оборудование для металлообработки со складов в Москве и Санкт-Петербурге.",
    areaServed: "Russia",
    address: {
      streetAddress: "Рябиновая улица, 63, стр. 4",
      addressLocality: "Москва",
      addressCountry: "RU",
    },
    contactPoints: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        telephone: manager.phone,
        email: company.email,
        areaServed: "RU",
        availableLanguage: ["ru"],
        hoursAvailable: {
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          opens: "09:00",
          closes: "19:00",
        },
      },
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: company.email,
        availableLanguage: ["ru"],
      },
    ],
    sameAs: [`https://t.me/${manager.telegram}`],
  });

  const website = buildWebsiteStructuredData({
    id: `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "7TOOL",
    inLanguage: "ru-RU",
    publisherId: `${SITE_URL}/#organization`,
  });

  return (
    <>
      <StructuredData data={organization} />
      <StructuredData data={website} />
    </>
  );
}
