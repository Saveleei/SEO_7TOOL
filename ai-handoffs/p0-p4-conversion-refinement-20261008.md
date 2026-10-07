# 7TOOL P0–P4 conversion refinement — 2026-10-08

## Scope

This pass implements the agreed buyer-path priorities without changing the production host. The candidate is intended for `new.7tool.ru` only and must remain closed to indexing.

## Acceptance matrix

| Area | 1440 / 1024 / 768 | 390 / 320 | Clarity and conversion | Status |
| --- | --- | --- | --- | --- |
| Homepage | Three launch paths are visually distinct; assortment and evidence remain in the first journey | Clear catalogue, task selection and specification/quote request; 320 px trust points no longer clip | The visitor sees what 7TOOL sells, how to enter the catalogue and how to request a quote | Ready for preview |
| Header and catalogue menu | Full desktop hierarchy; compact two-column direction accordion at 1024–768 without a nested double scroll | Full-screen accordion, search, all six directions, service links and email; expanded groups reset after closing | Catalogue, task selection and quote request remain the three primary entrances | Ready for preview |
| Category and subcategory | Two priority filters remain immediately available; the complete filter and engineer hand-off are progressive | Compact “All parameters / Engineer selection” row; genuine list and two-column grid modes | Products move closer to the category start while exact technical selection stays available | Ready for preview |
| Product page | Product title precedes the gallery in reading order; commercial summary remains alongside the media | Title, exact execution, photo and persistent quote action fit without horizontal overflow | Price, supply state and the primary action are exposed before supporting detail | Ready for preview |
| Trust section | One evidence bullet per photograph; three cards are visible without text duplication | Intro is limited to four scan lines; first three photographs are shown before optional disclosure | Warehouse, checking, picking and dispatch remain evidence-led and concise | Ready for preview |
| Quote request | Existing quote, attachment, comparison and mobile action contracts pass the full automated suite | Existing touch targets and persistent quote navigation remain intact | No live customer request was submitted during this visual pass | Regression-tested |
| Admin | No permissions, credentials or production data were changed | Not part of this storefront pass | Catalogue/trust editing remains a separate acceptance stage | Unchanged |

## Responsive evidence

- Audited widths: 1440, 1024, 768, 390 and 320 px.
- No horizontal document overflow was detected on the audited homepage, menu, category and product views.
- The mobile category grid renders two materially different columns (169.5 px cards at 390 px; 135.5 px cards at 320 px) and uses the compact `Variants · N` action.
- The richer list view retains specifications, comparison and the full product link.
- At 320 px the homepage proof row becomes two items plus a full-width compatibility item, so no text is clipped.

## Technical verification

- `npm test`: 411 passed, 0 failed.
- `npm run build` equivalent (`vinext build`): passed.
- ESLint: 0 errors; one pre-existing `@next/next/no-img-element` warning in `app/ui/YandexMetrika.tsx`.
- `new.7tool.ru` deployment must retain `X-Robots-Tag: noindex, nofollow, noarchive`, the matching HTML robots meta, disallowing `robots.txt`, an empty preview sitemap and disabled production analytics.
- `7tool.ru` production is intentionally unchanged by this pass.

## Implemented decisions

- The catalogue menu shows all six production directions without opening every category at once on tablet/mobile.
- Category quick selection is limited to the two strongest facets; full filtering and manual engineer selection remain available on demand.
- Mobile grid cards remove the duplicated secondary details link and shorten the variants action; the list view remains the detailed comparison-oriented presentation.
- Product title and identity now precede the gallery on mobile.
- Trust cards keep the real photograph, concise evidence and buyer outcome while removing repeated proof lists.

## Preview deployment

- Activated on `new.7tool.ru` at `2026-10-07T22:27:54Z` (server UTC timestamp).
- Active application: `/var/www/7tool-release-20261008-p0-p4-bfc30d4/design-exploration/staging-pilot`.
- Preview process: `7tool-storefront-new`, PID `134657`, port `3243`.
- Production process `7tool-prod` retained PID `132298`; `7tool.ru` was not switched.
- Rollback record: `/var/www/7tool-new-shared/backups/20261008-before-p0-p4-bfc30d4`.
- Post-activation public checks passed for the homepage, catalogue, category, product and comparison routes.
- Public preview checks reconfirmed the noindex meta policy, disallowing robots policy, empty sitemap, disabled production Metrica and absence of horizontal overflow at 390/320 px.
- Server filesystem after activation: 38 GB total, 6.8 GB available (83% used). The release itself occupies approximately 149 MB.
