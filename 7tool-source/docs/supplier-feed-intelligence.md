# PHASE 3 — Supplier Feed Intelligence

Статус: implemented behind explicit opt-in; production migration and activation require human review.

## Outcome

Supplier feed остаётся источником commerce updates, но теперь может параллельно записывать immutable observations с provenance:

```text
Configured FEED_URL / local FEED_FILE
  → parse + sanity checks
  → optional import_run + source_facts
  → existing catalog reconciliation
  → SQLite commerce upsert
  → atomic products.json snapshot
```

Публичные страницы и существующая логика каталога не изменены.

## Security changes

- Authenticated supplier URL удалён из source code.
- `FEED_URL` хранится только в runtime environment/secret store.
- Лог содержит только protocol + host; path, query и credentials не выводятся.
- `.env*`, SQLite, WAL/SHM, feed state/lock, backups и build caches исключены из Git.
- `.env.example` содержит только пустые placeholders.

Если `FEED_URL` не задан, importer принимает явный local argument/`FEED_FILE`. При отсутствии обоих источников процесс завершается до изменения каталога.

## Parser contract

`scripts/lib/supplier-feed-parser.mjs` извлекает:

- offer/group/groupId/status;
- product name, categoryId, vendorCode, vendor;
- description, barcode;
- price, old price, quantity, availability;
- parameters with normalized K2 prefix and unit;
- up to six unique HTTP(S) pictures;
- accessories.

Не-HTTP(S) image references отбрасываются. XML entities/CDATА декодируются. Parser version: `7tool-yml-v1`; fact schema: `supplier-facts-v1`.

## Provenance schema

Migration `001_supplier_feed_provenance` adds:

- `sources` — registry and rights policy;
- `import_runs` — checksum, parser/schema version, count and status;
- `source_facts` — typed observations by offer/predicate, checksum and source locator.

Supplier source создаётся с `rights_policy=CONTRACT_REQUIRED`. Это сознательно не подтверждает права на изображения и не разрешает их автоматическую публикацию/кэширование.

## Fact predicates

Current staged predicates: `name`, `sku`, `vendor`, `category_id`, `description`, `barcode`, `price`, `old_price`, `quantity`, `available`, `group`, `group_id`, `status`, `parameters`, `images`, `accessories`.

Observation не является verified assertion. PHASE 4 должна разрешать конфликты и создавать publishable facts с evidence.

## Migration procedure

Dry-run is default and never changes DB:

```bash
npm run db:migrate:seo
```

Production apply is forbidden until a separate SQLite backup exists and has been tested. Runner requires the backup explicitly and checks integrity of both files:

```bash
SQLITE_PATH=/absolute/shared/data.db \
node scripts/migrate-seo.mjs --apply --backup=/absolute/shared/backups/data-before-seo.db
```

Postflight runs `integrity_check` and `foreign_key_check`. Applied migration checksums are immutable in `seo_schema_migrations`. Recovery for this additive migration is restore of the verified backup; its SQL file also documents down order for controlled maintenance.

## Activation

Default:

```dotenv
FEED_PROVENANCE_ENABLED=0
```

After migration and human approval:

```dotenv
FEED_PROVENANCE_ENABLED=1
FEED_SOURCE_ID=supplier-k2tool
```

If provenance is enabled without the schema, feed sync fails closed before catalog write.

## Idempotency and storage

- Every import has a new run id and input checksum.
- Each observation has deterministic content checksum and run-scoped id.
- History is intentionally retained between runs; it supports changes/conflict analysis.
- Reprocessing the same XML creates another observation run, not a silent overwrite.
- Retention/compaction must be approved before production growth; do not delete history ad hoc.

## Operational checks before production

1. Confirm authoritative production DB path.
2. Create SQLite backup with the existing backup script.
3. Restore the backup into a temporary DB and verify application reads it.
4. Run migration dry-run, then apply to the restored copy.
5. Run a local feed import with provenance enabled against the restored copy.
6. Compare offer/product/variant/category counts with production baseline.
7. Inspect DB growth and import duration.
8. Confirm supplier facts/image rights contract.
9. Schedule a maintenance window and rollback owner.

## Tests

`tests/supplier-feed-intelligence.test.mjs` covers:

- typed parsing and XML decode;
- parameter normalization;
- rejection of unsafe image schemes;
- secret-safe source labels;
- mandatory backup gate;
- migration application on an isolated DB;
- source/import/fact persistence.

## Deferred to later phases

- fact verification and conflict resolution — PHASE 4;
- image download/cache/rights workflow — PHASE 10;
- supplier media publication — only after contract confirmation;
- semantic/content generation — PHASE 5+;
- production migration/cron enablement — explicit human operation after this review.

# STOP / HUMAN REVIEW REQUIRED
