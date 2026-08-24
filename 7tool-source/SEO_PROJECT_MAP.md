# SEO Project Map — 7TOOL.ru

Дата discovery: 18 августа 2026 года. Production: `https://7tool.ru`.

## Architecture

- Framework: Next.js 15.5.22, App Router, React 19.1, TypeScript, Tailwind CSS 4.
- Rendering: SSG для главной, категорий, подкатегорий и части товаров; ISR для товарных URL; SSR (`force-dynamic`) для рекламных landing pages и API.
- Backend: Next.js route handlers и server actions в том же приложении.
- Database: SQLite через `better-sqlite3`, WAL, production-файл `/var/www/7tool-shared/data.db`.
- Catalog snapshot: `src/lib/products.json`; используется для сборки, sitemap и статических индексов.
- Live layer: `/api/live` читает SQLite и после hydration обновляет цену/наличие на карточках.
- Production: Beget Cloud, PM2 `7tool-prod`, приложение на порту 3108, активный symlink `/var/www/7tool-current`.
- Deployment: production build в текущем release, затем `pm2 reload --update-env`; shared DB, environment, uploads и backups находятся вне release.
- Analytics: Яндекс Метрика `109097461` (build-time env и безопасный fallback), Ecommerce `dataLayer`, first-touch и last non-direct UTM, yclid и настоящий ClientID Метрики; внутренний UUID хранится отдельно.

## Main routes

| Route | Назначение | Rendering/indexing |
|---|---|---|
| `/` | Главная и вход в каталог | SSG, index |
| `/c/[slug]` | Категория | SSG, index |
| `/c/[slug]/[subslug]` | Подкатегория/задача | SSG, index при непустой подборке |
| `/p/[slug]` | Товарная группа или вариант | ISR/SSG, index |
| `/brand/[slug]` | Бренд | SSG, index |
| `/lp/[category]/[intent]` | Конверсионная посадочная | SSR; индексирование должно зависеть от SEO decision engine |
| `/kontakty`, `/dostavka-i-oplata`, `/garantiya-i-vozvrat` | Коммерческие страницы | SSG, index |
| `/politika-konfidencialnosti`, `/soglasie-na-obrabotku` | Юридические страницы | SSG, index |
| `/cart`, `/favorites` | Пользовательские состояния | SSG/CSR, noindex, follow |
| `/catalog` | Старый вход в каталог | permanent redirect на `/#categories` |
| `/admin/**` | Админка | middleware auth, robots.txt disallow |
| `/api/**` | Поиск, live-данные, заявки, корзина | dynamic API, robots.txt disallow |
| `/sitemap.xml`, `/robots.txt` | Crawl directives | Next metadata route / route handler |

## Data sources and Single Source of Truth

| Entity/fact | Source of truth | Derived consumers |
|---|---|---|
| Название, бренд, SKU, категории, характеристики, фото | дилерский XML feed | SQLite → JSON snapshot → HTML/metadata/schema |
| Цена, old price, количество, availability | SQLite после feed sync | `/api/live`, server rendering, JSON snapshot |
| Ручной SEO товара | SQLite `products.meta_*`, `seo_text`, `seo_source=manual` | JSON snapshot, metadata, JSON-LD description |
| Ручной SEO/фото/порядок категории | SQLite `categories` | JSON snapshot и category pages |
| Подкатегории | SQLite overrides + безопасные определения `subcategories.ts` | category/subcategory pages |
| Landing content | отдельная SQLite-таблица `landing_content` | `/lp/**`; feed её не изменяет |
| Контакты/организация | `src/lib/site-config.ts` | header, footer, forms, schema, metadata |
| Заявки и attribution | SQLite `leads` | admin, SMTP, offline conversions |

Цепочка каталога: `dealer XML → scripts/refresh-feed.mts → SQLite transaction → products.json snapshot → Next server HTML/metadata/JSON-LD → /api/live для свежей цены и наличия`.

## Feed and background jobs

- `scripts/refresh-feed.mts`: загрузка или безопасный fallback на локальный XML, валидация минимального числа offers, mapping feed category → site category, transaction update SQLite/JSON.
- Существующие категории вставляются через `ON CONFLICT DO NOTHING`; ручные title, SEO, cover, publication и sort order не перезаписываются.
- `scripts/hourly-refresh.sh`: feed sync; build/reload только при новых публичных URL.
- `scripts/nightly-rebuild.sh`: backup → feed sync → SEO fill для пропусков → snapshot → build → PM2 reload.
- SEO-генераторы по умолчанию заполняют только пустые поля; обновление существующих требует ручного `--refresh-existing`.

## SEO layer

- Root metadata: `src/app/layout.tsx`.
- Central robots helpers: `src/lib/seo-metadata.ts`.
- Category facts/content: `src/lib/category-content.ts`, `src/lib/category-seo.json`, DB category fields.
- Product metadata: `src/lib/product-seo.ts`, `src/app/p/[slug]/page.tsx`.
- Canonical: Next `alternates.canonical` в page metadata.
- Open Graph/Twitter: page metadata; category/product image uses corresponding catalog image.
- Structured data: `SiteJsonLd`, `ProductJsonLd`, category/subcategory/landing inline JSON-LD.
- Sitemap: `src/app/sitemap.ts`.
- Robots: `src/app/robots.txt/route.ts`.
- SEO automation: `generate-product-seo.mjs`, `generate-programmatic-seo.mjs`, `audit-seo.mjs`.

## Current catalog baseline

- Feed offers: 19,019; unsupported feed categories: 0.
- Product groups in snapshot: 4,295; non-draft: 4,286.
- Variants in non-draft groups: 18,355.
- Categories in storage: 26; published: 24.
- Sitemap URLs before this implementation: 21,126.

## Architectural risks

1. Static product payload and live SQLite layer can temporarily expose different price/availability in visible UI and JSON-LD.
2. Client-only category pagination has no crawlable page links and currently ignores direct `?page=N` state.
3. Brand pages render every full product/variant; Karnasch produced 36.1 MB HTML.
4. Brand URL is derived from raw lowercase text; spaces and `/` create invalid sitemap URLs or 404.
5. Automatically generated `/lp/**/podbor` pages are indexed without an assortment/intent/cannibalization decision.
6. `products.json` is large; importing it in client components or serializing full category arrays can hurt TTFB/LCP and build stability.
7. Feed and SEO generation need a shared machine-readable `SEO_DATA_CONFLICT` guard.
8. Category slug rename currently has no redirect registry.
