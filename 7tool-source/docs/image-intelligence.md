# PHASE 10 — Image Intelligence

Статус: implemented as a Supplier Feed-only, rights-first media library for articles. Production migration, supplier-media download, real asset processing and publication were not performed.

## Outcome

PHASE 10 превращает image requirement из одобренного `ArticleBrief` в проверяемый media workflow:

```text
Supplier Feed URL metadata
  → supplier-domain validation
  → DISCOVERED / CONTRACT_REQUIRED
  → immutable rights evidence proposal
  → human rights approval
  → reviewed local source file
  → SHA-256 + perceptual hash + WebP/AVIF variants
  → semantic ranking for one brief need
  → human depiction/ALT/placement approval
  → published article projection
```

Право использовать текстовые факты поставщика не даёт права использовать его изображения. `sources.rights_policy` и `media_rights_grants` являются разными контурами approval.

## Source boundary

`discoverSupplierMediaLibrary` читает только `products.images` и `variants.images`, связанные с активным `sources.source_type=SUPPLIER_FEED`.

- origin host должен совпадать с `source.base_url` или быть его поддоменом;
- credentials, localhost, private/link-local host и посторонний domain отклоняются;
- marketplace, SERP, competitor и произвольные web images не принимаются;
- discovery не выполняет HTTP-запрос и не скачивает ни одного файла;
- URL сначала получает `CONTRACT_REQUIRED` и не может попасть в public route.

Для `https://export.example` допустим `https://cdn.export.example/...`, но не `https://images-marketplace.example/...`.

Product/variant title, brand, category и supplier parameters создают только proposed metadata. Например параметр `Шпиндель = Weldon 19` создаёт semantic tag `Шпиндель Weldon 19`; это помогает ранжированию, но не заменяет визуальную проверку изображения редактором.

## Migration 008

`scripts/migrations/008_image_intelligence.sql` добавляет:

- `media_rights_grants` — immutable scope/evidence/uses/validity contract;
- `media_assets` — origin, provenance, rights, depiction, checksum and lifecycle;
- `media_tags`, `media_relations` — semantic library metadata;
- `media_generation_records` — immutable AI-generation provenance;
- `media_variants` — append-only WebP/AVIF derivatives;
- `media_selection_requests`, `media_selection_candidates` — brief need and deterministic ranking;
- `content_media` — human-approved contextual article placement;
- `media_audit_events` — append-only action trail.

Public license statuses are only `VERIFIED`, `OWNED`, `CONTRACT_APPROVED`. Rights grant additionally must be active and include `WEBSITE`, `CONTENT`, `DERIVATIVES`.

Migration is numbered, reversible in an isolated rehearsal, checksum-protected and remains subject to the existing backup-gated runner. It was not applied to production.

## Rights workflow

Rights proposal and approval are separate human actions. Proposal records:

- `SOURCE` or `ASSET` scope;
- copyright holder and license type;
- permitted uses;
- attribution requirement;
- evidence reference and externally calculated SHA-256;
- validity interval.

Grant content cannot be edited after insertion; correction requires a new grant. Approval never derives from Supplier Feed presence alone. Only one approved grant can own one scope.

Revocation immediately:

- changes affected assets to `RIGHTS_REVIEW / EXPIRED`;
- rejects their active `content_media` placements;
- makes derivative URLs return 404 through the database rights gate;
- retains files and audit history for recovery/legal review instead of silently deleting evidence.

## Local processing and public delivery

`processApprovedMedia` accepts an explicit local file path only after rights approval. It does not fetch `origin_url`.

Processing validates a single JPEG/PNG/WebP/AVIF file up to 50 MB and 80 megapixels, applies EXIF orientation, then stores:

- immutable original under `.media/originals/{sha256}.{ext}`;
- SHA-256 and 64-bit average perceptual hash;
- dimensions, MIME and byte size;
- WebP quality 82 and AVIF quality 55 at widths 320/640/960/1280 without enlargement.

Exact SHA duplicates become `SUPERSEDED`. Variant records and generation records are append-only. `.media/` is gitignored.

Only `/media/{asset-id}/{width}.{webp|avif}` and its PHASE 16 descriptive alias `/media/{asset-id}/{width}-{description}.{webp|avif}` are public. Both resolve to the same immutable storage key. Originals and origin URLs are never served by this route. Every request rechecks processed status, license and active grant, returns immutable cache headers, ETag and `nosniff`.

## Semantic selection

`createMediaSelectionRequests` converts current approved brief items into explicit needs. Typical mapping:

- `Weldon 19`, spindle, shank or component language → `PRODUCT_COMPONENT`;
- close-up/detail language → `PRODUCT_CLOSEUP`;
- compatibility/equipment language → `COMPATIBLE_EQUIPMENT`;
- ordinary product need → `PRODUCT_PHOTO`;
- required scheme/diagram → AI diagram pool.

Photo requests rank only processed, rights-approved `SUPPLIER_FEED` assets from the target product/category. Diagram requests rank only processed, rights-approved `AI_GENERATED` illustrative assets. Candidate score records semantic overlap, exact need, product/category, kind and component signals. Ranking cannot publish or select.

A human must confirm:

- what the image actually depicts;
- photograph kind;
- contextual ALT;
- article slot and optional section/caption.

If no eligible asset exists, the request becomes `NO_MATCH`. A human can accept `NO_MATCH_REVIEWED`; an unreviewed no-match blocks publication when the approved brief explicitly requires a supplier image.

## Contextual ALT

ALT describes the image in its article context, not just the catalog title. For a visually confirmed component, the suggested form is similar to:

`Шпиндель Weldon 19 — узел магнитного станка LENZ STEYR-35`

Validation requires 10–180 characters, overlap with the semantic need, and rejects URL/file names, a bare product title, repeated phrases and keyword stuffing. Suggested text remains subject to human confirmation because supplier parameters do not prove what is visible in a particular frame.

## AI diagrams

The registry accepts only:

- diagrams;
- infographics;
- technical illustrations;
- comparison schemes;
- concept drawings.

AI media must have an explicit disclosure, prompt hash/reference, provider/model, generation reference and output-terms reference. It cannot have `origin_url`, `real_product_id`, photograph depiction or product-photo kind. Public placement is limited to visibly labelled `DIAGRAM` or `COMPARISON` slots, and its ALT must identify it as a scheme/illustration.

PHASE 10 does not generate a real image automatically. Registration and processing begin only from a separately reviewed generated artifact and reviewed output rights; therefore an AI drawing cannot be presented as a real photograph of a particular product.

## Article publication and renderer

When an approved ArticleBrief contains `SUPPLIER_IMAGE`, publication requires one request in either:

- `SELECTED` with an approved processed asset and active rights; or
- `NO_MATCH_REVIEWED` with a named human reviewer.

At article publication, approved placements atomically become `PUBLISHED`. The public read projection returns only `content_media=PUBLISHED` joined to active rights and ready variants. The article page renders `<picture>` with AVIF/WebP `srcset`, contextual ALT, stable dimensions, caption/attribution and visible AI disclosure.

PHASE 16 moves shared product images to responsive Next Image variants. Hero and primary product images are eager/high-priority LCP candidates; noncritical cards and gallery thumbnails remain lazy.

## PHASE 16 image discovery

Published article media uses contextual ALT to create descriptive transliterated public filenames. The responsive AVIF/WebP renderer retains explicit dimensions and relevant surrounding article text. `/image-sitemap.xml` lists only local media exposed through published, indexable, human-reviewed articles and the existing active-rights read projection; supplier feed presence alone is not a rights grant.

## CLI

The CLI never applies a migration and never downloads a URL:

```bash
npm run seo:images -- discover --input=/absolute/discovery.json --db=/absolute/staged.db --apply
npm run seo:images -- rights-propose --input=/absolute/grant.json --db=/absolute/staged.db --apply
npm run seo:images -- rights-approve --input=/absolute/approval.json --db=/absolute/staged.db --apply
npm run seo:images -- process --input=/absolute/local-file.json --db=/absolute/staged.db --apply
npm run seo:images -- requests --input=/absolute/article.json --db=/absolute/staged.db --apply
npm run seo:images -- rank --input=/absolute/request.json --db=/absolute/staged.db --apply
npm run seo:images -- select --input=/absolute/selection.json --db=/absolute/staged.db --apply
npm run seo:images -- list --input=/absolute/filter.json --db=/absolute/staged.db
```

Mutations require `--apply`, `actorType` and `actorId`. Rights propose/approve/revoke, no-match review and final selection require `actorType=HUMAN`. Processing accepts only `HUMAN` or deterministic `SYSTEM`.

## Verification

Automated coverage includes:

- supplier/subdomain allowlist and unrelated-domain rejection;
- rejection of marketplace sources and absence of network download;
- proposed/approved/revoked rights lifecycle and immutable evidence;
- local image validation, orientation, checksums, variants and immutable records;
- semantic component matching for `Weldon 19`;
- AI-assisted ranking but human-only depiction/ALT/placement approval;
- contextual ALT and stuffing rejection;
- explicit AI disclosure and prohibition on simulated product photography;
- supplier-image publication/no-match gate;
- rights revocation removing public eligibility;
- migration indexes, rollback, complete regression, TypeScript and production build.

## Deferred

- production migration and any supplier contract approval;
- obtaining/downloading real source files under an approved supplier process;
- object storage/CDN and retention/backup operations for `.media`;
- admin rights/selection UI and production role mapping;
- Product Enrichment — PHASE 11;
- production validation of the PHASE 16 image sitemap and Next image optimizer cache;
- cross-channel image performance correlation — PHASE 18.

# STOP / HUMAN REVIEW REQUIRED
