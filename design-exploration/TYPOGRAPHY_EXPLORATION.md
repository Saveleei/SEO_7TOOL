# Typography exploration

Scores use a 10-point scale. Technical data is intentionally assigned a third, limited face where useful.

## Pair 1 — Manrope + Inter + IBM Plex Mono

- **Display:** Manrope 700/800
- **Body/UI:** Inter 400/500/600/700
- **Technical:** IBM Plex Mono 500/600
- **Character:** modern, calm, highly readable; risks a familiar digital-product/SaaS tone if spacing and imagery are generic.

| Criterion | Score |
|---|---:|
| Cyrillic quality | 9 |
| Body readability | 10 |
| Industrial character | 7 |
| Digits/prices | 9 |
| SKU/tables | 9 |
| Mobile | 10 |
| Avoids SaaS feeling | 6 |
| Longevity | 9 |
| **Average** | **8.6** |

## Pair 2 — IBM Plex Sans Condensed + IBM Plex Sans + IBM Plex Mono

- **Display:** IBM Plex Sans Condensed 600/700
- **Body/UI:** IBM Plex Sans 400/500/600
- **Technical:** IBM Plex Mono 500/600
- **Character:** explicitly engineering-led, structured, excellent numeric family coherence; can feel corporate or laboratory-like if overused.

| Criterion | Score |
|---|---:|
| Cyrillic quality | 9 |
| Body readability | 9 |
| Industrial character | 9 |
| Digits/prices | 10 |
| SKU/tables | 10 |
| Mobile | 8 |
| Avoids SaaS feeling | 9 |
| Longevity | 9 |
| **Average** | **9.1** |

## Pair 3 — Golos Text + IBM Plex Mono

- **Display:** Golos Text 700/800/900
- **Body/UI:** Golos Text 400/500/600
- **Technical:** IBM Plex Mono 500/600
- **Character:** confident contemporary Cyrillic, compact without being automotive or cyber, less generic in the Russian B2B environment.

| Criterion | Score |
|---|---:|
| Cyrillic quality | 10 |
| Body readability | 9 |
| Industrial character | 9 |
| Digits/prices | 9 |
| SKU/tables | 10 |
| Mobile | 9 |
| Avoids SaaS feeling | 9 |
| Longevity | 9 |
| **Average** | **9.3** |

## Selection

Choose **Golos Text + IBM Plex Mono**.

It gives 7TOOL a strong Cyrillic voice without novelty typography. Golos can carry headings and UI as one coherent family, reducing font-loading and rendering variance. IBM Plex Mono is reserved for SKUs, technical values, filters with counts, image annotations, and selected stock/price metadata. It must not be used for paragraphs or every label.

## Type scale

| Role | Desktop | Mobile | Weight | Notes |
|---|---:|---:|---:|---|
| Display hero | 72/70 | 44/43 | 800 | Maximum 11–13 words per line group |
| H1 product/category | 48/50 | 34/37 | 800 | No all caps by default |
| H2 | 40/43 | 30/34 | 700/800 | Strong section break |
| H3/card title | 19/25 | 17/23 | 600/700 | Two to three lines maximum |
| Body large | 18/28 | 17/26 | 400 | Hero support, intros |
| Body | 16/24 | 16/24 | 400 | Never shrink mobile form text below 16 px |
| UI | 14/20 | 14/20 | 500/600 | Controls and navigation |
| Metadata | 12/16 | 12/16 | 500 | Use gray-500 or darker |
| Technical | 12/16 | 12/16 | 500/600 mono | Tabular numerals, stable units |
| Price | 32/34 | 28/31 | 800 | Black, tabular figures |

## Typography rules

- Use sentence case for Russian UI and category names; reserve uppercase for short technical indices.
- Use non-breaking spaces between values and units: `35 мм`, `1 100 Вт`, `47 999 ₽`.
- Enable tabular figures for prices, quantities, measurements, and comparison tables.
- Keep paragraph measure between 56 and 72 characters.
- Use optical line breaks in hero copy; never force narrow desktop typography onto mobile.
