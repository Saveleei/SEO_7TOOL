# Yandex Wordstat Integration

Статус: secure file import implemented; direct official API calls are deferred until credentials/access and rate policy are approved.

## Credentials

Runtime-only variables:

```dotenv
YANDEX_WORDSTAT_TOKEN=
YANDEX_WORDSTAT_CLIENT_ID=
```

Tokens, login, password and Client Secret must never be placed in Git, frontend, HTML or logs. Current importer does not read or transmit these variables.

## Supported import formats

CSV/TSV/semicolon export and JSON are supported.

Recognized query columns:

- `query`, `phrase`, `keyword`;
- `фраза`, `запрос`.

Frequency aliases:

- `frequency`, `частотность`, `shows`, `показы`;
- `exact_frequency`, `точная частотность`, `exact`.

Optional fields: `existing_url`/`url`/`страница`, `category`/`category_slug`/`категория`, source id.

Example:

```csv
Фраза;Частотность;Точная частотность;Категория
магнитный сверлильный станок;1200;340;stanki-sverlilnye
как выбрать магнитный станок;310;95;stanki-sverlilnye
```

## Dry-run

Dry-run is default and does not open/write SQLite:

```bash
npm run seo:keywords:import -- \
  --file=/absolute/wordstat.csv \
  --source=WORDSTAT \
  --source-id=wordstat-moscow \
  --region=RU-MOW \
  --category=stanki-sverlilnye
```

Output contains row count and up to five normalized input records for inspection.

## Apply to a migrated non-production DB

```bash
SQLITE_PATH=/absolute/restored-copy.db \
npm run seo:keywords:import -- \
  --apply \
  --file=/absolute/wordstat.csv \
  --source=WORDSTAT \
  --source-id=wordstat-moscow \
  --region=RU-MOW \
  --category=stanki-sverlilnye
```

Requirements:

- migrations 001–003 already applied;
- referenced category exists;
- explicit region;
- frequencies are finite non-negative numbers;
- every query is 1–500 characters.

Apply stores an import checksum and creates PROPOSED clusters/intents for categories included in the rows.

## Region policy

Do not merge regional demand blindly. Use stable region codes agreed by the SEO team, for example `RU`, `RU-MOW`, `RU-SPE`. The code does not claim these as official API identifiers; they are internal storage keys until direct API mapping is approved.

## Direct API design (deferred)

When enabled, an official API adapter must:

1. use runtime secret store/OAuth;
2. log request id, region, timestamps and counts, never token/query credentials;
3. obey official quotas/rate limits;
4. retry only safe/idempotent requests with backoff;
5. store raw response checksum and parser version;
6. reject partial responses before updating current observations;
7. separate network collection from normalization/clustering;
8. provide manual import fallback.

No browser scraping or credential automation is permitted.

## Data use

Wordstat is demand discovery, not proof that a new URL is required. Every cluster must still pass existing-page mapping, SERP review, differentiation and cannibalization gates.

# STOP / HUMAN REVIEW REQUIRED
