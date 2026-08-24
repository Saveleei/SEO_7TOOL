# PHASE 14 — Lead Generation

Статус: implemented as intent-specific public forms plus normalized lead attribution. Migration 012 was verified only on isolated SQLite databases; production migrations, real submissions and notification delivery were not performed.

## Conversion contract

Content does not ask for a phone number without explaining the result. Every content/tool form resolves one reviewed profile:

| Profile | CTA | Primary use |
|---|---|---|
| `MAGNETIC_DRILL_SELECTION` | Подобрать 3 подходящих станка | magnetic drill selection |
| `EQUIPMENT_SELECTION` | Подобрать 3 подходящие модели | other equipment selection |
| `CUTTER_SELECTION` | Подобрать корончатое сверло | annular cutter selection |
| `KIT_CALCULATION` | Получить расчёт комплекта | calculator/kit follow-up |
| `COMPATIBILITY_CHECK` | Проверить совместимость | compatibility content/table |
| `COMMERCIAL_OFFER` | Получить коммерческое предложение | commercial/product request |

Each profile owns its neutral promise, two task-specific questions, CTA key, lead type and success message. The prohibited generic CTA «Оставьте телефон» is not used. An article may explicitly select a profile through the human-reviewed `lead_form_type`; unknown values are rejected when a revision is saved. Without an explicit profile, category and reviewed search intent determine the safe default.

## Public integration

- Article pages render the intent form after semantic next steps and repeat the exact CTA in the sticky sidebar.
- Calculator/selector/compatibility pages resolve a profile from the verified tool type.
- Category selection forms keep their category-specific questions and use the matching profile CTA.
- Product quote surfaces use «Получить коммерческое предложение» when price is unavailable.
- Existing cart, contact, landing, one-click and price-match flows remain operational and receive a fallback CTA key based on their lead type.

Forms continue to require an explicit personal-data consent at the API boundary, accept phone or email according to the existing validation contract, preserve rate limiting and submission idempotency, and reuse the current notification outbox.

## Attribution contract

At submission time PHASE 14 records a one-to-one `lead_attribution_snapshots` row with:

- `article_id` when the public source is an article;
- full safe `page_url` and normalized `page_path`;
- reviewed keyword cluster;
- category and validated public product;
- intent key and normalized CTA key;
- safe referrer;
- UTM source, medium, campaign, content and term;
- browser session ID stored in `sessionStorage`;
- deterministic acquisition source;
- lead timestamp.

Article, cluster, category and intent are resolved server-side from the current public article rather than trusted from client fields. Product IDs are accepted only when they identify a non-draft product. Invalid CTA keys fall back to the allowlisted lead type.

Source precedence is deterministic:

```text
yclid → yandex_ads
UTM source → utm:<normalized source>
search-engine referrer → organic:<host>
other external referrer → referral:<host>
no external evidence → direct
```

The existing persistent internal client ID is not treated as a session. PHASE 14 adds a separate session-scoped ID and keeps Yandex Metrica client ID distinct.

## Migration 012

`scripts/migrations/012_lead_generation.sql` adds the attribution snapshot table and indexes for actual analysis queries by article, cluster, CTA, session and source. Rows cannot be updated. Deletion remains possible only through lead retention/cascade so the attribution layer does not block PII deletion policy.

The application checks for the table before writing. Therefore lead delivery remains backward-compatible before migration 012; attribution snapshots begin only after the guarded migration is explicitly applied.

## Verification

`tests/lead-generation.test.mjs` covers:

- all required intent/CTA profiles and rejection of an unknown form type;
- deterministic paid/organic/referral/direct source classification;
- server resolution of trusted article, cluster, category and intent context;
- product, CTA, referrer, every UTM field, session and timestamp storage;
- immutable snapshots and pre-migration compatibility;
- real SQLite index selection and clean migration rollback.

Full regression, TypeScript validation, migration 001–012 dry-run and isolated production build remain required before handoff.

## Human-gated next steps

- apply migration 012 to a restored production backup, then only after explicit approval to production;
- confirm final CTA/profile assignment for real published content;
- submit real forms only after privacy/retention owners approve the attribution fields;
- configure real notification providers separately from this phase;
- connect aggregated lead outcomes to SEO performance in PHASE 18.

# STOP / HUMAN REVIEW REQUIRED
