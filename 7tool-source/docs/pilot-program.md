# Phase 19 — bounded SEO pilot

Статус: реализован воспроизводимый planning/review/measurement layer для пяти категорий. Реальные opportunities не импортировались, production migration не применялась, контент и URL автоматически не создавались и не публиковались.

## Fixed scope

Pilot намеренно ограничен ровно пятью реальными категориями каталога:

| # | Направление | Category slug |
|---:|---|---|
| 1 | Магнитные сверлильные станки | `stanki-sverlilnye` |
| 2 | Корончатые сверла | `koronchatye-sverla` |
| 3 | Кромкорезы | `kromkorezy-po-listu` |
| 4 | Труборезы | `truborezy` |
| 5 | Борфрезы | `borfrezy` |

Код не принимает произвольный шестой category и не имеет режима Scale. Для каждой категории SQL и runtime ограничивают выборку максимумом 500 opportunities, Top 20 и пятью content work items. Всего один готовый selection run содержит не более 2 500 candidates, ровно 100 Top opportunities и ровно 25 work items.

## Selection contract

Источником служит только текущая проекция `content_opportunities` из Phase 8. Допускаются `PROPOSED` и `REVIEWED` решения `UPDATE`, `MERGE`, `CREATE`; `REJECT` и superseded evidence исключаются.

Ranking следует уже принятой платформенной политике existing-page-first:

1. `UPDATE`;
2. `MERGE`;
3. `CREATE`;
4. внутри решения — `opportunity_score DESC`, затем стабильная сортировка topic/id.

Первые 500 записываются как immutable candidate snapshot. Первые 20 получают `top_rank`. Selection checksum фиксирует rank, score, decision, type, target URL и точный `evaluation_checksum`, поэтому повторный запуск с тем же evidence идемпотентен, а изменённое evidence создаёт новый review run.

Planner не объявляет pilot готовым, если хотя бы в одной категории:

- нет полных Top 20;
- отсутствуют два article-compatible opportunity;
- нет отдельного `TROUBLESHOOTING`;
- нет `COMPARISON` или `TABLE`;
- нет `CATEGORY_ENRICHMENT`/`PRODUCT_ENRICHMENT` с существующим target URL и решением `UPDATE`/`MERGE`.

Такой fail-closed режим не подменяет отсутствующую семантику выдуманной темой.

## Initial content mix

Для каждой категории selection run создаёт только review work items:

- 2 × `ARTICLE`;
- 1 × `TROUBLESHOOTING`;
- 1 × `COMPARISON_TABLE`;
- 1 × `PRODUCT_CATEGORY_ENHANCEMENT`.

Каждый item ссылается на отдельный opportunity из Top 20. Его одобрение требует:

1. неизменный `evaluation_checksum` относительно selection snapshot;
2. текущий opportunity со статусом `REVIEWED`;
3. явные reviewer id и `--apply`.

Одобрение work item разрешает редакционную работу, но не создаёт asset, route или public URL. Articles затем проходят Phase 9: brief, fact/evidence, SEO, expert и final approvals. Product/category enhancement проходит соответствующий evidence/review workflow Phase 11 или контролируемое обновление существующей категории. Только после одобрения всех 25 items reviewer может одобрить сам pilot plan. Даже это одобрение не публикует контент.

## KPI contract

Snapshot строится отдельно для каждой категории и для всего pilot. Tracked URL set включает:

- baseline `/c/<category_slug>`;
- существующий target URL выбранного `UPDATE`/`MERGE`;
- canonical связанного `content_asset`, когда редакционный workflow уже создал asset.

Метрики:

| KPI | Evidence |
|---|---|
| Indexation | `site_urls.index_status = INDEX` / все tracked URLs |
| Impressions, clicks | последний полный GSC WEB run + последний полный Yandex Webmaster run, покрывающие период |
| Queries | distinct `engine + query_hash`, без смешивания одинаковых hash разных систем |
| CTR | суммарные clicks / суммарные impressions |
| Position | impression-weighted average по строкам с известной position |
| Product clicks | последний exact-period `content_roi_snapshots` для каждого tracked URL |
| Lead rate | attributed organic leads / organic sessions |
| Organic leads | `content_roi_snapshots.leads` для tracked URL |
| Revenue | подтверждённый order revenue в копейках, RUB |

GSC, Webmaster и ROI evidence должны относиться к одному периоду. Для ROI допускается только точное совпадение `period_start`/`period_end`, чтобы широкий snapshot не выдавался за более узкое окно. Если attributed leads превышают organic sessions, KPI блокируется как несогласованный, а не обрезается до красивого процента.

Все шесть KPI rows immutable, `REVIEW_REQUIRED` и сохраняют exact GSC/Yandex run IDs, список ROI snapshot IDs, model version и evidence checksum.

## Staged workflow

Preview плана не пишет в БД:

```bash
npm run seo:pilot -- plan \
  --db=/absolute/staged.db
```

После проверки Top 20 и отдельного backup-gated применения migration 016:

```bash
npm run seo:pilot -- plan \
  --db=/absolute/staged.db \
  --created-by=seo-pilot-owner \
  --apply
```

Одобрение одного work item и затем всего полного плана:

```bash
npm run seo:pilot -- review-item \
  --db=/absolute/staged.db \
  --item-id=PILOT_ITEM_ID \
  --decision=APPROVE \
  --reviewed-by=editor \
  --apply

npm run seo:pilot -- review-program \
  --db=/absolute/staged.db \
  --decision=APPROVE \
  --reviewed-by=pilot-owner \
  --apply
```

KPI preview и materialization:

```bash
npm run seo:pilot -- kpi \
  --db=/absolute/staged.db \
  --start=2026-08-01 \
  --end=2026-08-20 \
  --gsc-property=sc-domain:7tool.ru \
  --yandex-host=https:7tool.ru:443
```

Добавление `--apply` записывает только KPI snapshots. Команда `status` показывает scope, последний selection, review counts и последние KPI.

## Migration 016

- `pilot_programs` — immutable bounded configuration с human review state;
- `pilot_categories` — фиксированные пять category snapshots;
- `pilot_selection_runs` — immutable evidence/checksum/count envelope;
- `pilot_opportunity_selections` — до 500 ranked candidates и Top 20 на категорию;
- `pilot_content_work_items` — 25 reviewable 2+1+1+1 assignments;
- `pilot_kpi_snapshots` — пять category rows плюс общий pilot row.

Индексы следуют реальным запросам selection rank, review queue, latest selection и latest KPI. Migration additive, checksum-controlled, имеет explicit down section и запускается только существующим backup-gated runner.

## Human gates before a real pilot

1. Восстановить production backup в отдельную staging DB и применить migrations 001–016 только к ней.
2. Импортировать и проверить категории, semantic clusters, reviewed SERP, business inputs и opportunities.
3. Получить не менее 20 допустимых scored opportunities на каждую pilot category и проверить все 100 Top records.
4. Одобрить 25 work items; создать и довести сами материалы через действующие content/enrichment quality gates.
5. Публиковать только отдельно одобренные assets/updates, небольшими партиями с наблюдением indexation и качества.
6. Импортировать сопоставимые GSC, Webmaster, Metrica/CRM periods и сверить KPI вручную.
7. Решение о Phase 20 принимать отдельно; Phase 19 не содержит scale-команды.

# STOP / HUMAN REVIEW REQUIRED
