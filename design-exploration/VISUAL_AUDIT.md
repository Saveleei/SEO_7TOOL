# 7TOOL visual audit

Audit date: 2026-09-10. This is a visual and UX assessment of the live site; it does not recommend URL, SEO, catalog, feed, or business-logic changes.

## Executive diagnosis

7TOOL currently communicates a real catalog, real inventory, engineering help, and commercial readiness. Trust is its strongest visual outcome. Recognition is weaker: without the logo and orange buttons, much of the system could belong to another modern equipment store. The main causes are excessive repetition of card containers, several simultaneous orange signals, inconsistent product-image scale, dense microcopy, and insufficiently characteristic typography and technical-data composition.

The most valuable move is subtraction plus standardization: fewer bounded panels, larger normalized equipment, one orange focal action per viewport, stronger numerical alignment, and selective use of the 7-cut.

## Score matrix

Scale: 1 = weak, 10 = world-class. `—` means photography is not materially applicable. Columns: VH visual hierarchy, TY typography, CO colors, SP spacing, DE density, CN consistency, PH photography, TR trust, SC perceived scale, BR brand recognition.

| Element | VH | TY | CO | SP | DE | CN | PH | TR | SC | BR |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Header | 6 | 6 | 5 | 5 | 4 | 6 | — | 7 | 6 | 5 |
| Catalog menu | 6 | 6 | 5 | 6 | 6 | 6 | 5 | 6 | 6 | 4 |
| Search | 7 | 7 | 6 | 7 | 6 | 7 | — | 7 | 7 | 5 |
| Homepage | 7 | 6 | 5 | 6 | 4 | 6 | 5 | 7 | 7 | 5 |
| Category system | 7 | 6 | 5 | 5 | 4 | 6 | 5 | 6 | 7 | 5 |
| Category cards | 5 | 5 | 4 | 5 | 3 | 5 | 4 | 6 | 6 | 4 |
| Category listing | 6 | 6 | 5 | 5 | 4 | 7 | 4 | 7 | 7 | 4 |
| Filters | 6 | 6 | 5 | 5 | 3 | 6 | — | 7 | 7 | 3 |
| Product cards | 6 | 5 | 4 | 4 | 3 | 6 | 4 | 7 | 6 | 4 |
| Product page | 7 | 6 | 5 | 6 | 5 | 7 | 7 | 8 | 7 | 5 |
| Price presentation | 7 | 6 | 4 | 5 | 4 | 7 | — | 8 | 7 | 4 |
| Availability | 7 | 6 | 5 | 6 | 6 | 7 | — | 8 | 7 | 4 |
| Forms | 6 | 6 | 5 | 5 | 4 | 7 | — | 7 | 6 | 3 |
| CTA system | 6 | 6 | 4 | 5 | 3 | 6 | — | 7 | 6 | 4 |
| Technical specifications | 7 | 6 | 5 | 6 | 6 | 7 | — | 8 | 7 | 4 |
| Breadcrumbs | 6 | 6 | 5 | 6 | 7 | 7 | — | 6 | 6 | 3 |
| Articles | 6 | 6 | 5 | 5 | 4 | 6 | 6 | 7 | 6 | 4 |
| Information/proof blocks | 6 | 6 | 5 | 5 | 3 | 6 | 6 | 8 | 7 | 4 |
| Footer | 5 | 5 | 6 | 5 | 3 | 6 | — | 7 | 6 | 5 |
| Desktop overall | 7 | 6 | 5 | 6 | 4 | 6 | 5 | 7 | 7 | 5 |
| Mobile overall | 6 | 5 | 5 | 4 | 3 | 6 | 4 | 7 | 6 | 4 |

## Prioritized findings

### P0 — Horizontal overflow on the 390 px product page

- **Problem:** the live product page measured 398 px document width inside a 390 px viewport.
- **Why it matters:** even a small overflow destabilizes sticky controls, produces accidental sideways movement, and signals weak mobile QA.
- **Current impact:** the highest-intent page has a measurable layout defect on the brief's critical width.
- **Recommendation:** identify the overflowing gallery/CTA/manager element, constrain descendants with `min-width: 0`, and verify at 320, 360, 375, and 390 px with no horizontal scroll.

### P1 — Orange is used as a repeated UI color rather than a single signal

- **Problem:** discount labels, small badges, category counters, icon buttons, primary actions, and decorative lines often coexist in orange.
- **Why it matters:** focal hierarchy collapses when every commercial signal has equal chromatic urgency.
- **Current impact:** pages feel more promotional and marketplace-like than precise and industrial.
- **Recommendation:** keep orange for one primary action or selected state per viewport; move availability to green, prices to black, discounts to graphite, and most icons to neutral.

### P1 — Product imagery lacks a unified visual scale

- **Problem:** portrait machines, horizontal cutting tools, manufacturer renders, isolated PNGs, and low-resolution photos occupy inconsistent proportions and leave visibly different empty fields.
- **Why it matters:** equipment is the brand hero; inconsistent scale makes the catalog feel aggregated rather than curated.
- **Current impact:** cards with the same commercial priority appear to have different importance and quality.
- **Recommendation:** normalize to image classes, fixed safe areas, subject bounding boxes, common baseline, consistent light background, and automated quality flags. See `PRODUCT_IMAGE_STANDARD.md`.

### P1 — Category cards carry too many simultaneous messages

- **Problem:** product count, discount count, brand chips, three statistics, description, CTA, and image compete inside each category tile.
- **Why it matters:** category choice should be recognition-first, not a miniature dashboard.
- **Current impact:** 23 repeated cards create a very long, dense homepage and reduce the perceived value of each image.
- **Recommendation:** lead with category name and dominant product; keep count as one quiet technical datum; move availability/discount summaries to category pages or hover/detail states.

### P1 — Product cards over-explain every item

- **Problem:** image, variant count, favorite, brand, SKU, long name, specs, discount, availability, price, old price, tax note, cart, product link, and quote action all compete.
- **Why it matters:** comparison speed is the core catalog task.
- **Current impact:** the eye must repeatedly parse low-priority labels before reaching price and fit.
- **Recommendation:** use the hierarchy image → brand/name → 2–3 comparable specs → availability → price → one action. Keep quote as a contextual secondary action, not a competing full-time control on every card.

### P1 — The header is credible but too busy

- **Problem:** utility links, dealer claim, hours, phone, email, trust items, catalog, large search, favorites, and cart occupy several competing rows.
- **Why it matters:** the header should establish scale and get buyers to search or catalog immediately.
- **Current impact:** strong search loses authority inside many equally small utility signals.
- **Recommendation:** preserve logo, Catalog, full-width search, Contacts, and Get Quote; reduce utility copy and move detailed assurances into a single thin evidence strip.

### P1 — Homepage hero has too many routes and internal objects

- **Problem:** primary CTA, secondary CTA, an additional selection link, proof bullets, featured-product commercial card, badges, price, and multiple product links share the first screen.
- **Why it matters:** the 3–5 second message should answer who/what/why/next with one dominant product story.
- **Current impact:** it reads partly as a campaign banner and partly as a storefront module.
- **Recommendation:** keep one headline, one concise support line, one primary CTA, one secondary CTA, three proof metrics, and one large piece of equipment in a controlled cut composition.

### P1 — Mobile homepage is a long reduced desktop sequence

- **Problem:** all category cards and repeated product modules stack into a page exceeding the useful decision horizon.
- **Why it matters:** mobile buyers need search, task categories, short proof, and a fast route to quote/catalog.
- **Current impact:** important sections are separated by many screens of repetition.
- **Recommendation:** design a mobile-specific category shortlist, provide “all categories,” keep one compact product rail, and preserve product scale instead of simply stacking every desktop block.

### P1 — Mobile filter drawer contains nested long scroll regions

- **Problem:** filter groups become independent scroll areas within a full-height drawer.
- **Why it matters:** nested scrolling is hard to understand, particularly with long brand and technical-value lists.
- **Current impact:** users can lose orientation and the persistent “show results” action is not immediately visible.
- **Recommendation:** use one drawer scroll container, collapsible groups, selected-value summary, search only where lists justify it, and a sticky results button.

### P1 — Product page first screen is split into several card-like containers

- **Problem:** gallery, price/action card, personal-manager card, delivery/guarantee cards, and further service units all compete as boxed surfaces.
- **Why it matters:** serious B2B equipment pages gain authority from continuity, scale, and controlled alignment.
- **Current impact:** the commercial offer feels assembled from widgets despite strong underlying content.
- **Recommendation:** use one two-column product canvas with minimal containers: gallery left; brand, H1, SKU, specs, availability, price/VAT/delivery, Cart, and Quote right.

### P1 — CTA semantics are not visually distinct enough

- **Problem:** Cart, one-click buy, quote, selection help, messenger, and price-match actions can appear at similar prominence.
- **Why it matters:** equipment buyers have different intents, but one next step still needs to dominate each context.
- **Current impact:** conversion energy is divided across competing actions.
- **Recommendation:** product with stock/price: Cart primary, Quote secondary. Complex/no-price product: Quote primary, consultation secondary. Selection form: Submit is the only orange control.

### P2 — Typography is functional but not ownable

- **Problem:** current grotesk hierarchy is readable yet visually interchangeable with many ecommerce systems.
- **Why it matters:** recognition cannot depend on the logo and orange alone.
- **Current impact:** headings, cards, and technical values do not form a memorable voice.
- **Recommendation:** adopt a deliberate display/body/technical trio with stronger Cyrillic character and tabular numbers; see `TYPOGRAPHY_EXPLORATION.md`.

### P2 — Technical data needs a stronger comparison rhythm

- **Problem:** the product table is useful but behaves as a conventional card/table; technical values are not a signature element across listings and product pages.
- **Why it matters:** specifications are one of the clearest opportunities to make 7TOOL distinct and more useful simultaneously.
- **Current impact:** trust is good, but engineering character remains generic.
- **Recommendation:** align values to a stable right edge, use tabular numerals, repeat units consistently, add a subtle index/section rule, and expose the top comparison specs earlier.

### P2 — Breadcrumbs are correct but visually detached

- **Problem:** breadcrumbs are small, generic, and sometimes sit inside a crowded transition between header and content.
- **Why it matters:** in a deep industrial taxonomy they are a high-value orientation tool.
- **Current impact:** hierarchy is present but not strongly legible.
- **Recommendation:** keep them compact but give them a consistent content-grid position, restrained contrast, and touch-safe wrapping on mobile.

### P2 — Article pages need a more editorial industrial voice

- **Problem:** useful knowledge content is presented with familiar website-card rhythms and limited technical-image direction.
- **Why it matters:** expertise content should make the supplier feel like an engineering authority.
- **Current impact:** articles build SEO and trust but contribute less to brand recognition than they could.
- **Recommendation:** use a narrower reading measure, stronger section numerals, full-width technical figures, macro/detail photography, pull-out decision tables, and restrained product modules.

### P2 — Proof blocks are credible but visually repetitive

- **Problem:** warehouse proof, guarantees, manager contact, and service claims repeat in similarly bordered units.
- **Why it matters:** evidence is powerful only when it feels specific rather than templated.
- **Current impact:** trust remains high, but perceived scale does not rise proportionally with the amount of proof.
- **Recommendation:** consolidate evidence into fewer, larger compositions: one warehouse strip, one numeric proof block, one named human contact, and one quote pathway.

### P2 — Footer has low scanability

- **Problem:** many small links occupy a large dark block with limited grouping contrast.
- **Why it matters:** buyers use the footer for reassurance, legal context, and recovery navigation.
- **Current impact:** it feels dense and older than the strongest parts of the site.
- **Recommendation:** reduce visible groups, strengthen category labels, enlarge contact details, and keep deep-link directories in progressive disclosure on mobile.

### P3 — Iconography is inconsistent in visual weight

- **Problem:** utility icons, proof icons, favorites, cart, arrows, and decorative marks do not yet read as one technical family.
- **Why it matters:** repeated small inconsistencies erode the precision promise.
- **Current impact:** minor, but noticeable across long catalog sessions.
- **Recommendation:** define one 1.5 px geometric stroke system, square terminals, 20/24 px grids, and prohibit mixed filled/outline libraries.

## What should remain

- Existing SEO hierarchy, routes, category copy, breadcrumbs, and knowledge content.
- Real stock counts, VAT clarity, delivery statements, official-dealer claims, and human contact.
- Full search capability and technical filters.
- The two-column product-page information architecture.
- Product and category data as the source of truth.
