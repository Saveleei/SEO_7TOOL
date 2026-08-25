# Score-driven content scaling

PHASE 20 expands an approved pilot through reviewed ceilings of 25, 50, 100 and 250 published items. A ceiling is a safety boundary, not a publishing quota: the system never generates content, fills a batch or publishes automatically. Editors enqueue individual READY pages in descending Opportunity Score order.

## Publication gates

An approved scorecard is tied to the current content revision and current evidence checksum. Approval requires:

- `QualityScore >= 85`, using the fixed 100-point weighted model;
- `EvidenceScore >= 80`, derived from verified sources, compatibility, image rights, pain data, calculations and expert approval;
- `DifferentiationScore >= 60`, with a written rationale and concrete proof of unique user value;
- no hard fail for invented technical data, duplicate intent, severe cannibalization, copyright, canonical ownership, misleading claims, duplicate content or missing unique value.

When a scale program is ACTIVE or SCORE_DRIVEN, publication additionally requires a due, human-approved `content_publish_queue` item. The final page transition and queue transition to PUBLISHED are one database transaction. Before scale activation, the existing Content Platform flow remains compatible.

## Review workflow

All mutating commands require `--apply` and operate on the SQLite path passed with `--db` (or `SQLITE_PATH`). Use only a restored staging database with a separate verified backup.

```bash
npm run seo:scale -- assess --db=/absolute/staged.db --input=/absolute/scorecard.json --apply
npm run seo:scale -- review-scorecard --db=/absolute/staged.db --scorecard-id=<id> --decision=APPROVE --reviewed-by=<actor> --apply
npm run seo:scale -- create-scale --db=/absolute/staged.db --pilot-id=<id> --kpi-snapshot-id=<id> --rationale="<review evidence>" --created-by=<actor> --apply
npm run seo:scale -- review-checkpoint --db=/absolute/staged.db --review-id=<id> --decision=APPROVE --reviewed-by=<actor> --apply
npm run seo:scale -- candidates --db=/absolute/staged.db --scale-program-id=<id> --limit=100
npm run seo:scale -- enqueue --db=/absolute/staged.db --scale-program-id=<id> --content-id=<id> --scheduled-at=<epoch-ms> --requested-by=<actor> --apply
npm run seo:scale -- review-queue --db=/absolute/staged.db --queue-id=<id> --decision=APPROVE --reviewed-by=<actor> --apply
npm run seo:scale -- status --db=/absolute/staged.db --scale-program-id=<id>
```

After the current ceiling has actually been published, attach a new whole-pilot KPI snapshot and request the next human review:

```bash
npm run seo:scale -- request-checkpoint --db=/absolute/staged.db --scale-program-id=<id> --kpi-snapshot-id=<id> --rationale="<review evidence>" --created-by=<actor> --apply
```

Approval at 250 switches the program to SCORE_DRIVEN: the numerical ceiling is removed, while Opportunity Score ordering, scorecards, hard fails, evidence freshness and human queue approval remain mandatory.

## Migration 017

- `content_scale_programs` stores the approved pilot provenance and active ceiling;
- `content_scale_checkpoint_reviews` stores immutable KPI-backed human decisions;
- `content_quality_scorecards` stores weighted quality, evidence, differentiation and hard-fail evidence;
- `content_publish_queue` stores explicit content-by-content publication decisions.

Core evidence is immutable and audit rows cannot be deleted. Query indexes cover queue dispatch, candidate prioritization, scorecard lookup and checkpoint history.

# STOP / HUMAN REVIEW REQUIRED
