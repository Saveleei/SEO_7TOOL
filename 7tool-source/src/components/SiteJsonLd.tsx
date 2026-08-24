import { absoluteUrl, company, manager, SITE_URL } from "@/lib/site-config";

export function SiteJsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "7TOOL",
    legalName: company.legalName,
    url: SITE_URL,
    logo: absoluteUrl("/icon.svg"),
    image: absoluteUrl("/og.png"),
    email: company.email,
    telephone: manager.phone,
    description:
      "Промышленный инструмент и оборудование для металлообработки со складов в Москве и Санкт-Петербурге.",
    areaServed: { "@type": "Country", name: "Russia" },
    address: {
      "@type": "PostalAddress",
      streetAddress: "Рябиновая улица, 63, стр. 4",
      addressLocality: "Москва",
      addressCountry: "RU",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        telephone: manager.phone,
        email: company.email,
        areaServed: "RU",
        availableLanguage: ["ru"],
        hoursAvailable: "Mo-Fr 09:00-19:00",
      },
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: company.email,
        availableLanguage: ["ru"],
      },
    ],
    sameAs: [`https://t.me/${manager.telegram}`],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: "7TOOL",
    inLanguage: "ru-RU",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
