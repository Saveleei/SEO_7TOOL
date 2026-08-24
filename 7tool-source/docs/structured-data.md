# PHASE 15 — Structured Data

Статус: implemented locally for the current public templates. Deployment, Rich Results Test against a public URL and Search Console validation were not performed.

## Evidence-first policy

JSON-LD describes only content that a visitor can see and only commerce facts present in the current server-side read model. Fewer complete properties are preferred to guessed or incomplete ones.

| Schema | Public placement | Evidence source |
|---|---|---|
| `Organization` + `WebSite` | root layout | current site contacts, address and working hours |
| `ProductGroup` / `Product` | canonical product route | current SQLite product and variant projection |
| `Offer` | product/variant with a positive current price | the same variant record that renders price and availability |
| `Brand` | nested in a product | non-empty supplier/product brand |
| `BreadcrumbList` | category, landing, product and article routes | the visible navigation path and canonical URL |
| `Article` | `PUBLISHED + INDEX + human_reviewed=1` article route | the same public article projection rendered on the page |
| `VideoObject` | none yet | no public page currently contains an eligible watchable video |

`FAQPage`, `CollectionPage` and `ItemList` remain on templates where the matching FAQ or collection is visible. All JSON-LD now passes through one script-safe renderer.

## Product property policy

| Property | Rule |
|---|---|
| `name` / `description` | variant-aware public SEO projection |
| `image` | existing product/variant URLs only |
| `sku` | supplier variant SKU; group SKU only when stored |
| `brand` | omitted for blank or placeholder brand |
| `gtin8/12/13/14` | emitted only for a barcode of the corresponding length |
| `mpn` | supported by the builder, but omitted now because the catalog has no separately verified MPN; SKU is never copied into it |
| `price` / `priceCurrency` | emitted together only for a finite positive price; current currency is `RUB` |
| `availability` | exact current variant state: `InStock`, `PreOrder` or `OutOfStock` |
| `itemCondition` | supported only when explicitly supplied; omitted now because condition is not a verified catalog field |
| `shippingDetails` | requires an explicit `verified` policy with country, currency and rate |
| `hasMerchantReturnPolicy` | requires an explicit `verified` policy with country and a complete return category/window |

The public delivery and returns pages are currently marked `needsOwnerConfirmation`. They do not provide a universal shipping rate, delivery window, return category or return window. Consequently shipping and returns must remain absent from production JSON-LD until the owner verifies and publishes those terms.

## Canonical and freshness guarantees

- Product price, availability, HTML and JSON-LD are rendered from the same current SQLite record.
- A product data conflict suppresses Product JSON-LD and marks the route noindex.
- A `?variant=` UI selection on a group URL does not change the canonical entity. Only a canonical variant slug emits standalone variant Product markup.
- `AggregateOffer` is built only from variants with complete price/currency Offers.
- Seller references the single global Organization `@id`; contact data is not duplicated into every Offer.
- Organization working hours use `OpeningHoursSpecification`, not an untyped text value.

## Article policy

The Article node uses the visible H1, excerpt, author, expert reviewer, category, dates and reviewed keyword projection. Images are included only from rights-eligible published article media; a text-only article has no `image` property. Its `mainEntityOfPage`, `@id` and BreadcrumbList use the canonical article URL. Publisher and `isPartOf` reference the global Organization and WebSite nodes.

## Video gate

The VideoObject builder requires all of the following before returning a node:

- visible name and description;
- a real HTTPS thumbnail;
- valid upload date;
- a real `contentUrl` or `embedUrl` for a video users can watch on the page.

An opportunity classified as VIDEO, an image, or a textual mention of video is not sufficient.

## Safety and validation

- URLs accept only HTTP(S); invalid protocols are dropped.
- Optional empty values and incomplete policies are omitted.
- The shared serializer escapes `<`, `>`, `&` and Unicode line separators to prevent an editor-controlled value from terminating the JSON-LD script.
- Automated tests cover all Phase 15 schemas, canonical variant behavior, incomplete-field omission and the VideoObject hard gate.
- Final handoff requires full tests, TypeScript, an isolated production build and regression against representative rendered routes.

References: [Google structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies), [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product), [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article), [Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb), [Video structured data](https://developers.google.com/search/docs/appearance/structured-data/video).

# STOP / HUMAN REVIEW REQUIRED
