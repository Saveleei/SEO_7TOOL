# Deprecated / Hardcoded Data Report — 7TOOL.ru

Дата сканирования: 18 августа 2026 года.

## Canonical current values

- Domain: `https://7tool.ru` from `site-config.ts` / `NEXT_PUBLIC_SITE_URL`.
- Phone: `+7 (962) 611-24-19`.
- Email: `info@7tool.ru`.
- Address: `Москва, Рябиновая улица, 63, стр. 4`.
- Company display name: `7TOOL`; configured legal name: `ООО «7TOOL»`.

## Findings

| Severity | Finding | Location | Action |
|---|---|---|---|
| P1 | Homepage metadata says “nine directions”, while 24 categories are published | `src/app/page.tsx` | replace with non-stale wording based on the current catalog |
| P1 | Organization schema image is the manager portrait | `src/components/SiteJsonLd.tsx` | use company OG/logo image; keep manager photo only in manager UI |
| P1 | Legal name, privacy retention terms and final legal wording are not owner-confirmed | `site-config.ts`, privacy/consent pages | owner/legal review required; do not invent details |
| P1 | Commercial claims about same-day shipment, documents and warehouses are repeated in templates | product/category/landing SEO templates | keep only owner-confirmed facts; centralize future changes |
| P2 | `admin@7tool.local` is an installation fallback, not a public contact | `scripts/import-json-to-sqlite.mjs` | acceptable for local bootstrap; never render publicly |
| Historical only | Old test domain/phone are mentioned in audit history | `AUDIT.md` | preserve as history; not used at runtime |

No active runtime references to `test.7tool.ru`, a `+7 (495) 000-00-00` phone, old public email, or alternate production domain were found outside historical documentation and local bootstrap defaults.

