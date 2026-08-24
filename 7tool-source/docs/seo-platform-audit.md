# SEO Platform Audit — 7TOOL

Дата аудита: 24 августа 2026 года. Объём: только PHASE 0 + архитектурная оценка точек интеграции. Изменения приложения, БД, маршрутов, интеграций и контента не выполнялись.

## EXECUTIVE SUMMARY

7TOOL уже имеет сильную ecommerce/SEO-базу: SSR/SSG на Next.js, человекочитаемые URL, динамические metadata/canonical, XML sitemap, robots.txt, Product/Offer/Breadcrumb/Collection/FAQ JSON-LD, защищённые фасеты, Яндекс Метрику, ecommerce-события, лиды с атрибуцией и безопасную синхронизацию дилерского фида.

Главные ограничения перед Content Intelligence Platform:

1. Git-репозиторий находится в состоянии `No commits yet on master`, весь исходник untracked. Создать надёжную feature-ветку невозможно до первого baseline-коммита; попытка записи ref также получила `HEAD.lock: Permission denied`.
2. Два источника каталога расходятся: локальная `data.db` имеет схему, но 0 товаров/категорий/вариантов; `src/lib/products.json` содержит 4 295 товарных групп, 4 286 live и 18 364 варианта.
3. Snapshot содержит 26 категорий (24 опубликованы), 912 live-товаров без исходного описания, 654 без product-level изображения и 277 без SKU. Обнаружено 16 групп одинаковых title.
4. Все найденные товарные изображения (10 228 ссылок) загружаются с `s3.export.k2tool.ru`: нет Media Knowledge Base, локального/CDN-кэша, правового статуса, hash/dedup и производных размеров.
5. Google Analytics/GTM и автоматизированные GSC/Yandex Webmaster/Wordstat-интеграции в коде не найдены. Яндекс Метрика реализована глубоко, включая ecommerce и offline conversions.
6. `/lp/` защищены anti-cannibalization gate: noindex + canonical на категорию/подкатегорию до ручного подтверждения. Это правильная база для правила ONE INTENT → ONE PAGE.
7. Реальные CWV не измерялись через CrUX/RUM; архитектурно основные риски — тысячи статических URL, большой JSON snapshot, внешние изображения, карточки/фильтры с клиентским JS и потенциальная разница build-time/live данных.

Приоритет до PHASE 2: зафиксировать baseline в Git, определить authoritative catalog store, восстановить воспроизводимый импорт локальной БД, подтвердить права на supplier images и получить доступ к GSC/Yandex Webmaster/production telemetry.

## CURRENT TECH STACK

- Frontend/backend: Next.js 15.5.22 App Router, React 19.1, TypeScript 5.
- Styling: Tailwind CSS 4/PostCSS, собственные React-компоненты.
- Runtime: Node.js 20+; image processing — `sharp`.
- Database: SQLite через `better-sqlite3`, WAL + foreign keys.
- Build data: `src/lib/products.json`; operational data: `data.db`/`SQLITE_PATH`.
- Hosting: Beget, PM2, reverse proxy; атомарные releases/current и shared data описаны в runbook.
- Jobs: hourly feed refresh, nightly rebuild, DB backup, notification/offline-conversion queues.
- Tests: Node test runner; на аудите 28/28 тестов прошли.

## CURRENT SITE ARCHITECTURE

Основные публичные маршруты: `/`, `/c/{category}`, `/c/{category}/{subcategory}`, `/p/{slug}`, `/brand/{slug}`, `/lp/{category}/{intent?}`, служебные страницы, `/cart`, `/favorites`. `/catalog` перенаправляет на `/#categories`. Админка содержит товары, категории, подкатегории, лендинги и лиды. API покрывает поиск, live price/stock, корзину, избранное, лиды, call tracking и фоновые очереди.

Рендеринг смешанный: известные категории и товары предварительно генерируются, но разрешены runtime-параметры. Оперативные цена/наличие читаются из SQLite клиентским live-контуром, а SEO/структурированные данные зависят от build snapshot.

## PRODUCT DATABASE

SQLite-схема включает `products`, `variants`, `categories`, `subcategories`, `landing_content`, `leads`, `users`, `sessions`, очереди уведомлений, offline conversions и call tracking. Product хранит JSON-поля images/accessories/param_axes и SEO-поля; Variant — SKU, barcode, price, quantity, params и images.

Локальная БД пуста, поэтому её нельзя считать проверенным зеркалом snapshot. В JSON: 4 295 products, 4 286 live, 18 364 variants; 24 опубликованные категории дают 4 274 потенциально публичных product records до дополнительных quality gates. Это требует формального source-of-truth и reconciliation job.

## SUPPLIER FEED

Источник — дилерский XML/YML feed K2Tool (`FEED_URL`, с локальным `FEED_FILE` fallback). Импорт `scripts/refresh-feed.mts` извлекает id/groupId, vendorCode, vendor, name, categoryId, description, barcode, price/oldPrice, quantity/availability, params, pictures и accessories.

Защиты: lock-файл, timeout 90 секунд, минимум 5 000 offers, уникальность id, allowlist mapping категорий, запрет неполной публикации, retirement отсутствующих вариантов, транзакционный upsert SQLite и атомарная замена JSON. Существующая категория и её ручной SEO-контент не перезаписываются feed-ом.

Риски: секретоподобный URL фида имеет hardcoded fallback; parser regex-based, нет versioned raw staging/provenance per field; description обновляется только если текущая пуста; отсутствуют supplier/source/evidence entities.

## IMAGE PIPELINE

`ProductImage` использует `next/image`; live DOM показывает корректные alt и размеры, но все исследованные supplier assets грузятся напрямую с K2Tool S3. На главной первый hero/product image тоже lazy-loaded, что создаёт риск для LCP. Нет local originals, WebP/AVIF derivatives под контролем 7TOOL, rights/license status, source attribution, perceptual hash или image sitemap.

## CATEGORY ARCHITECTURE

Snapshot: 26 категорий, 24 опубликованы; `vibroopory` и `verstaki` скрыты. Категории имеют title/H1/intro/SEO text/meta/cover/image alt. Подкатегории определены правилом по параметрам и названиям; пустые не публикуются. Категорийные страницы содержат breadcrumbs, stats, quick tasks, товары, подбор, SEO-блок и FAQ.

## PRODUCT PAGE SEO

Сильные стороны: уникальный `/p/` slug, variant-aware canonical, dynamic metadata, BreadcrumbList, Product/Offer и FAQPage, EAN/SKU/brand, цена/availability, related products, подбор и lead CTA. Проверенный пример LENZ STEYR-35 имеет один H1, canonical, index/follow и Product JSON-LD.

Риски: build/live рассинхронизация price/availability; 912 live records без supplier description; массово сгенерированные meta/SEO text могут быть формально уникальны, но не обязательно дифференцированы; 16 duplicate-title clusters; слабые/общие FAQ без evidence layer; отсутствуют verified compatibility, applications, limitations и source-level facts.

## CATEGORY PAGE SEO

Проверенная категория имеет уникальные title/description/H1, canonical, CollectionPage/Breadcrumb/FAQ schema и содержательный подбор. Риски: общий шаблон на 24 направления, длинный DOM, листинг и фильтры на клиенте, нет измеренной differentiation/evidence score, а ItemList содержит только текущую страницу при общем `numberOfItems`.

## TECHNICAL SEO

Подробности — в `docs/technical-seo-audit.md`. Базовые controls присутствуют и на live-шаблонах работают. Нужны production crawl, HTTP header audit, log analysis, real sitemap validation и CWV telemetry.

## FACETED NAVIGATION

Параметры brand/sort/facets формируют функциональный URL, но получают `noindex, follow` и canonical на базовую категорию. Пагинация имеет отдельный canonical. `Clean-param` перечисляет только marketing parameters; фильтры сознательно не очищаются на уровне robots. Это безопасная текущая стратегия, но будущие SEO-facet landings должны быть отдельными reviewed routes, а не индексацией query combinations.

## INDEXATION

`robots.txt` разрешает публичный сайт и запрещает `/admin` и `/api`, содержит Host, Sitemap и Clean-param. Sitemap включает static/category/subcategory/brand/product URLs и исключает `/lp/`. Cart/favorites/no-match pages имеют noindex. Не подтверждены X-Robots-Tag reverse proxy, фактический production sitemap count/status всех URL, soft-404 и orphan rate.

## STRUCTURED DATA

Обнаружены Organization, WebSite, Product/Offer, BreadcrumbList, CollectionPage, ItemList и FAQPage. Нет Article/VideoObject, что соответствует отсутствию базы знаний/видео. До масштабирования необходим automated Rich Results/schema validator и запрет schema без видимого/проверенного контента.

## ANALYTICS

Яндекс Метрика counter 109097461: clickmap, trackLinks, accurateTrackBounce, ecommerce dataLayer, SPA hits, goals, attribution capture, ecommerce actions и offline conversion upload. Webvisor выключен. Lead attribution хранит source/referrer/UTM/client id и landing context.

GA4/GTM, GSC и Yandex Webmaster ingestion не найдены. Нет единого URL/query/revenue fact table и заявленных content-specific scroll/calculator events.

## CORE WEB VITALS RISKS

- Hero/первый критический товарный image наблюдался с `loading=lazy`.
- External S3 adds DNS/TLS latency and removes cache/format control.
- Large client-side filter/listing payload and repeated product cards may hurt INP.
- Image dimensions в DOM заданы, что снижает CLS, но remote source stability не гарантирована.
- Большой build snapshot и тысячи prerendered routes увеличивают build/cache pressure и TTFB on miss.
- Реальные p75 LCP/INP/CLS неизвестны без CrUX/RUM.

## CONTENT QUALITY RISKS

Нет Fact/Evidence layer, экспертного workflow и provenance per claim. Автоматическая SEO-генерация уже существует, но quality gate проверяет главным образом уникальность/формальные признаки. Требуются FACT_REQUIRED, evidence source, expert review и differentiation gate до любой новой индексируемой страницы.

## DUPLICATION RISKS

16 групп одинаковых product titles; variant query URLs и variant slugs требуют постоянной canonical consistency; category/subcategory/landing intents частично пересекаются; generic generated SEO text/FAQ может иметь высокую semantic similarity при различающихся строках.

## CANNIBALIZATION RISKS

Наибольший риск: `/c/`, `/c/.../...`, `/lp/`, brand и product family pages по одинаковым коммерческим запросам. Текущий `landingSeoDecision` корректно canonicalize/noindex непроверенные лендинги. До создания `/articles/` нужен intent registry по всем существующим URL и semantic similarity checker.

## PROPOSED DATA MODEL

Сохранить Product/Variant/Category как commerce core; добавить Source, Fact, FactEvidence, Supplier, Brand, ProductFeature, Compatibility, Application, Problem, Keyword, Cluster, Intent, Opportunity, ContentAsset, ArticleBrief, MediaAsset, ReviewInsight, PainPoint, InternalLink, LeadAttribution и SEOPerformance. Не хранить всё в JSON-полях: факты, evidence и compatibility должны быть нормализованы и versioned.

## PROPOSED KNOWLEDGE GRAPH

Начать с relation table `(subject_type, subject_id, predicate, object_type, object_id, status, evidence_id, verified_at, verified_by)`. Разрешать публикацию только VERIFIED relations. Feed facts — отдельный источник, ручная/экспертная коррекция не должна теряться при refresh.

## PROPOSED SEMANTIC ENGINE

Import → normalize → deduplicate → cluster → classify intent → map existing URL → SERP type → cannibalization/differentiation check → opportunity. Ключевой выход — action CREATE/UPDATE/MERGE/REJECT и best page type, а не keyword page.

## PROPOSED REVIEW INTELLIGENCE ENGINE

Хранить агрегированные ReviewInsight/PainPoint, URL источника, platform, short permissible snippet, timestamps и counts. Не хранить/публиковать полные чужие отзывы и изображения. Все connectors должны соблюдать API/robots/ToS/rate limits.

## PROPOSED IMAGE SYSTEM

MediaAsset с source type, rights/license status, origin URL, local object key, SHA/perceptual hash, dimensions/MIME, semantic tags, relations и derivatives 320/640/960/1280 WebP/AVIF. Supplier images публиковать только после письменного подтверждения права; competitor/marketplace assets — RESEARCH_ONLY.

## PROPOSED CONTENT SYSTEM

ArticleBrief-first workflow; statuses из master prompt; immutable evidence snapshot; Quality/Evidence/Differentiation scores; hard fails; explicit human approval. `/articles/` добавлять лишь после intent audit и editorial governance.

## PROPOSED GOOGLE SEO SYSTEM

GSC OAuth/service integration вне frontend, query/page/device/country daily facts, quick-win rules, sitemap/index coverage, image performance и URL inspection sampling. Credentials только в secret store/env.

## PROPOSED YANDEX SEO SYSTEM

Wordstat demand + Webmaster performance + Metrika behavior/leads в отдельных raw/staged marts; region-aware queries; offline conversions уже можно связать с future opportunity/content ids.

## PROPOSED LEAD SYSTEM

Расширить существующий Lead: content/opportunity/cluster/product set/CTA/form type, qualification, quote/order/revenue/margin и CRM status history. Не менять текущую очередь уведомлений до выбора CRM и data retention policy.

## REQUIRED DATABASE MIGRATIONS

В PHASE 2, не сейчас: versioned migration runner; raw_source/import_run/fact/evidence; normalized media; keyword/cluster/intent/opportunity; graph relations/compatibility; content workflow; performance facts; lead attribution extensions. Перед любыми миграциями — production backup, integrity check и rollback rehearsal.

## REQUIRED FILE CHANGES

Будущий scope: migration framework; `src/lib/seo-platform/*`; import adapters; admin SEO Intelligence routes; media storage/optimizer; analytics schema; tests; `.env.example`; документация. Сейчас изменены только два audit-документа.

## IMPLEMENTATION ROADMAP

1. Human review текущего аудита и закрытие вопросов Git/source-of-truth/rights/access.
2. Повторяемый production crawl + GSC/Webmaster/CWV baseline.
3. PHASE 2 schema ADR и reversible migrations.
4. PHASE 3 feed staging/provenance.
5. PHASE 4 verified knowledge graph.
6. Далее строго по фазам master prompt; pilot только после quality gates.

## RISKS

P0: отсутствует baseline commit; пустая local DB; неясный authoritative store; права на supplier media не подтверждены. P1: external image hotlinking, build/live mismatch, отсутствие GSC/Webmaster/GA ingestion, массовая формальная SEO-генерация без evidence, duplicate/cannibalization. P2: CWV, schema completeness, crawl-depth/orphans и retention policies требуют измерений.

## QUESTIONS / ASSUMPTIONS

1. Кто создаёт первый baseline commit и предоставляет write access к `.git`?
2. Что authoritative на production: SQLite, JSON snapshot или supplier feed?
3. Почему локальная `data.db` пуста; должен ли архив включать актуальный безопасный dump?
4. Подтверждено ли договором право локально хранить и публиковать K2Tool images?
5. Есть ли доступы к GSC, Yandex Webmaster, Wordstat и production Metrika reports?
6. Какой reverse proxy/CDN реально используется и какие X-Robots/cache headers он добавляет?
7. Какая CRM authoritative для lead → quote → order → margin?
8. Кто будет реальным expert reviewer и владельцем publish approval?

# STOP / HUMAN REVIEW REQUIRED
