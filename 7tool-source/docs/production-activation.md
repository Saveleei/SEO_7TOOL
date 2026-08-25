# SEO Platform Production Activation Runbook — 7TOOL

Статус: **FRESH BACKUP VERIFIED / MIGRATIONS NOT APPLIED / APPLY APPROVAL REQUIRED**
Дата проверки: 26 августа 2026 года
Локально проверенный SEO commit: `aa70adc`

## Scope

Этот runbook относится только к созданию схемы SEO & Content Intelligence Platform миграциями `001`–`018`.

Применение миграций:

- не создаёт публичные URL;
- не импортирует GSC, Wordstat, Webmaster, Метрику, отзывы или SERP;
- не публикует статьи, лендинги, изображения или product enrichment;
- не запускает pilot, scaling или pruning;
- не меняет price, stock, SKU и другие commerce facts.

Любой импорт, публикация и lifecycle-операция остаются отдельным human-gated шагом.

## Authoritative data hierarchy

1. Supplier feed/raw import — источник полученных supplier observations.
2. Shared production SQLite — operational source of truth для commerce facts.
3. `src/lib/products.json`/shared snapshot — производный build artifact, не master data.
4. SEO fact/evidence layer — проверенные утверждения; он не владеет ценой и остатком.

Нельзя выполнять `db:import` поверх действующей production-БД как обычный release step: snapshot способен заменить оперативные значения. Импорт допустим только для новой/восстанавливаемой БД после отдельного решения.

## Verified dry-run evidence

Dry-run выполнен на изолированной SQLite-копии, созданной штатным SQLite backup API с учётом WAL, затем наполненной текущим catalog snapshot.

| Check | Result |
|---|---|
| Base commerce schema | 15 tables including products, variants, leads and operational queues |
| Catalog fixture | 26 categories, 111 subcategories, 4 295 products, 18 364 variants |
| Migrations | `001`–`018` applied successfully |
| Resulting schema | 116 tables, 18 checksummed registry rows |
| Commerce row preservation | category/product/variant/lead/queue counts unchanged |
| SQLite integrity | `ok` before and after |
| Foreign key check | 0 errors before and after |
| Idempotency | second apply completed with 0 additional migrations |
| Recovery | restored database has original schema and row counts |
| Backup identity | restored SHA-256 exactly matches the verified pre-migration backup |

Local migration time was about 0.52 seconds. This proves correctness on the fixture, not a production latency guarantee.

## Actual production preflight — 26 August 2026

Read-only checks were run in the Beget server console. No production file, process, schedule or database row was changed.

| Check | Production result |
|---|---|
| Active release | `/var/www/7tool-release-20260826-seo-dedupe/7tool-source` |
| Production commit | `b19e5da1736ea034c2de9930aba0b63eb014f110` |
| PM2 | existing `7tool-prod` process online |
| Shared filesystem | 38 GiB total, 20 GiB used, 19 GiB available (52% used) |
| Memory | 3.8 GiB total, 2.6 GiB available; swap disabled |
| Production SQLite | `/var/www/7tool-shared/data.db`, about 62 MiB |
| SQLite integrity | `ok` |
| Foreign-key violations | 0 |
| Commerce control counts | 26 categories, 129 subcategories, 4,295 products, 18,364 variants, 52 leads |
| SEO migration registry | absent (`seo_schema_migrations` table count = 0); migrations `001`–`018` are not applied |
| Migration dry-run | exactly `001`–`018` listed from the production release |
| SQLite writers found in crontab | hourly/nightly feed refresh and per-minute notification queue processor |
| Latest existing separate backup | `/var/www/7tool-shared/backups/data-2026-08-25T21-48-28-153Z.db` |
| Existing backup integrity | `ok` |
| Existing backup SHA-256 | `42d0fdd293957f001c70d17ff894007470bbcc9d8deb78b6936ba715e0674b35` |
| Fresh approved pre-apply backup | `/var/www/7tool-shared/backups/data-2026-08-25T22-42-02-255Z.db`, about 62 MiB |
| Fresh backup integrity / foreign keys | `ok` / 0 violations |
| Fresh backup SHA-256 | `f8eb090061099b21742eb8c51709bd2657ead7747db9e2e8a67f761f5a5b0876` |

The production subcategory count is 129, while the isolated fixture contained 111. The primary commerce counts (categories, products and variants) match, and the migration set is additive, but all postflight comparisons must use the production values above. The fresh WAL-aware backup was created after explicit human approval and is the designated rollback target for this apply window.

## Production preflight — read-only

Before any write, record without printing secrets:

```bash
readlink -f /var/www/7tool-current
pm2 describe 7tool-prod
df -h /var/www/7tool-shared
crontab -l
cd /var/www/7tool-current
set -a
. /var/www/7tool-shared/.env.production
set +a
npm run db:migrate:seo
```

Required results:

- `SQLITE_PATH` resolves to shared storage outside a release directory;
- current DB passes `PRAGMA integrity_check` and `PRAGMA foreign_key_check`;
- enough disk is available for the current DB, verified backup and temporary SQLite files;
- dry-run lists exactly migrations `001`–`018` with the committed checksums;
- current PM2 name, current release and writer jobs are recorded;
- no unknown rows exist in `seo_schema_migrations`.

If the production schema or counts differ materially from the tested commerce schema, stop and repeat the dry-run on a WAL-aware backup of that exact database.

## Backup gate

From the active release with production env loaded:

```bash
npm run db:backup
```

Then record the absolute backup path and SHA-256, open the backup read-only and require:

```text
PRAGMA integrity_check = ok
PRAGMA foreign_key_check = 0 rows
```

A raw copy of only `data.db` is not an acceptable backup while WAL is enabled. Use the provided SQLite backup command so committed WAL pages are included.

## Controlled apply

Use a short maintenance window. Pause only the identified SQLite writer jobs and prevent new application writes; do not replace the entire crontab. Keep the saved crontab and current PM2/release state for recovery.

With the verified absolute backup path:

```bash
cd /var/www/7tool-current
set -a
. /var/www/7tool-shared/.env.production
set +a
npm run db:migrate:seo -- --apply --backup=/absolute/path/to/verified-backup.db
```

Expected output: exactly 18 `applied ...` lines on the first run. Any checksum mismatch, integrity error, foreign-key error or lock timeout is a hard stop.

## Postflight

Before resuming writers:

1. Require SQLite integrity `ok` and 0 foreign-key errors.
2. Require 18 rows in `seo_schema_migrations`, from `001_supplier_feed_provenance` through `018_content_refresh`.
3. Compare commerce counts for categories, products, variants, leads and operational queues with preflight values.
4. Run `npm test` and the representative live SEO check.
5. Reload the existing `7tool-prod` process; do not create a second PM2 app.
6. Resume only the writer jobs paused for the window and verify the saved schedule.
7. Smoke-check homepage, category, product, cart, lead creation, admin, robots and both sitemaps.

## Recovery

Normal code rollback does not require DB rollback because migrations are additive. Restore the DB only on confirmed schema/data failure:

1. stop the app and all SQLite writers;
2. preserve the failed DB under a new timestamped filename;
3. verify the approved backup path and SHA-256 again;
4. restore the verified SQLite backup to `SQLITE_PATH` with the original owner/permissions;
5. require integrity `ok` and 0 foreign-key errors;
6. start the same PM2 process and writer schedule;
7. repeat smoke checks.

Never restore while the app or feed job is writing.

## Approval gate

The next allowed operation is applying migrations `001`–`018`. This is a separate production database write and requires explicit human approval after the fresh backup path, integrity result and SHA-256 above have been shown.

# STOP / HUMAN REVIEW REQUIRED
