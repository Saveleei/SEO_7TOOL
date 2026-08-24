# PHASE 12 — Calculators, Selectors & Compatibility Tables

Статус: implemented as a human-published, verified-data-only tool platform. Migration 010 and all workflows were tested on isolated SQLite databases; production migrations, rules, product facts and public tool records were not created.

## Why this is separate from articles

A reviewed search opportunity can recommend an interactive answer instead of editorial prose. PHASE 12 introduces dedicated `/tools` routes and a lifecycle for five priority surfaces:

- Annular Cutter RPM Calculator;
- Magnetic Drill Selector;
- Beveler Selector;
- Pipe Cutter Selector;
- dynamic Compatibility Table.

An opportunity does not publish a tool. A public set still requires an explicit draft, a current evidence check, human approval and a separate human publication action.

## Publication and indexation contract

`interactive_tool_sets` stores immutable, versioned configuration and metadata. Its lifecycle is:

```text
DRAFT → human APPROVED → human PUBLISHED
    ↘ human REJECTED
PUBLISHED + changed evidence/opportunity → hidden immediately → STALE
new PUBLISHED version → previous version SUPERSEDED
```

AI-assisted and deterministic system actors may create drafts. Only a `HUMAN` actor may approve, publish or reject them. Reviews and audit events are append-only.

The safe default is `NOINDEX`. `INDEX` requires a linked `content_opportunity` with all of these properties:

- `status=REVIEWED`;
- `decision=CREATE`;
- `cannibalization_risk=LOW`;
- `recommended_page_type=CALCULATOR`, or `TABLE`/`COMPATIBILITY` for the compatibility table.

Only current `PUBLISHED + INDEX` tools enter the sitemap. The header link appears only when at least one valid published tool exists. Missing migration 010 or an empty publication set produces an honest `noindex` empty state.

## Annular Cutter RPM Calculator

The calculator never contains a generic fallback speed. Each selectable pair of cutter type and material requires a current `VERIFIED` assertion:

| Assertion field | Required value |
|---|---|
| `subject_type` | `TOOL_RULE` |
| `subject_id` | `annular-cutter-rpm:<normalized-cutter>:<normalized-material>` |
| `predicate` | `CUTTING_SPEED_M_PER_MIN` |
| numeric value | reviewed cutting speed |
| unit | `m/min` |
| evidence | one or more non-conflicting facts from active `PUBLISHABLE_FACTS` sources |

The output uses the deterministic formula `RPM = 1000 × cutting speed / (π × diameter)`. A missing exact cutter/material rule returns no calculation. The result states the coefficient used and reminds the user to verify the machine, cutter passport, cooling and actual cutting conditions.

Changing an assertion, evidence checksum, source activity, rights policy or reviewed opportunity makes the public calculator unavailable before a stale scan runs. The scan then records `STALE` deterministically.

## Equipment selectors

Selectors do not accept manually authored product rules. They read live projections from:

- `product_features` backed by current `VERIFIED` assertions;
- `product_applications` with `SUPPORTED` or `BETTER_FOR` suitability;
- active, public products in the relevant commerce category.

Current category boundaries are explicit:

| Selector | Commerce categories |
|---|---|
| Magnetic Drill | `stanki-sverlilnye` |
| Beveler | `kromkorezy-po-listu`, `kromkorezy-dlya-trub` |
| Pipe Cutter | `truborezy` |

Canonical feature aliases and units are allowlisted. Numeric comparisons accept verified millimetres, kilograms or degrees as appropriate; there is no silent unit conversion. Conflicting values for the same capability are omitted. A missing required capability excludes the product rather than treating it as a match.

Priority inputs implemented from the master prompt:

- Magnetic Drill: diameter, depth, material, thread requirement and weight limit;
- Beveler: plate/pipe, thickness, angle range, bevel width and material;
- Pipe Cutter: diameter, wall thickness, material and application.

The UI may start with partial inputs, but every selected condition must have a verified matching fact. A zero-result state explicitly distinguishes “not verified” from “does not exist”.

## Dynamic compatibility table

The table reads only current `product_compatibility` rows with `verified=1` and `compatibility_status=COMPATIBLE`. It also requires a separate current `USES_ACCESSORY` relation to prove which product is the equipment and which is the accessory; normalized product IDs are never used as a semantic direction. Both products must be public, and both assertions are rechecked against publishable evidence.

Columns are:

`Product → Compatible accessories → Shank → Max diameter → Depth → Application`.

Shank, diameter, depth and application come from the same verified feature/application projection as selectors. A dash means that the value is not verified; it is not inferred from names, descriptions or supplier copy. `CONDITIONAL`, `INCOMPATIBLE` and `UNKNOWN` relations do not appear in this positive compatibility table.

## CLI workflow

The CLI never applies migrations and every mutation requires `--apply`, an input file and an explicit actor.

Example RPM draft input:

```json
{
  "toolType": "ANNULAR_CUTTER_RPM",
  "indexStatus": "NOINDEX",
  "actorType": "AI_ASSISTED",
  "actorId": "tool-assistant",
  "rules": [
    {
      "cutterType": "HSS",
      "material": "Сталь",
      "cuttingSpeed": 25,
      "assertionId": "verified-rule-assertion-id"
    }
  ]
}
```

Example selector draft:

```json
{
  "toolType": "MAGNETIC_DRILL_SELECTOR",
  "indexStatus": "NOINDEX",
  "actorType": "SYSTEM",
  "actorId": "tool-candidate-v1"
}
```

Commands against an explicitly selected, already migrated database:

```powershell
npm run seo:tools -- draft --input=tool-draft.json --db=isolated.db --apply
npm run seo:tools -- approve --input=human-review.json --db=isolated.db --apply
npm run seo:tools -- publish --input=human-review.json --db=isolated.db --apply
npm run seo:tools -- stale --input=stale-scan.json --db=isolated.db --apply
npm run seo:tools -- list --db=isolated.db
```

## Public integration

- `/tools` lists only valid published tools;
- `/tools/[slug]` renders the calculator, selector or table from the curated projection;
- React renders structured text and tables; no stored HTML is accepted;
- selectors link only to public product routes;
- responsive forms and tables preserve keyboard/touch access;
- the existing visual system is reused rather than introducing a separate tool UI.

PHASE 13 adds a separate, human-published semantic link projection. A selector may point to a product only when that product remains in its current verified dataset (or a HUMAN records an explicit curation basis). A product may point to the compatibility table only while its verified compatibility row remains public. Tool publication alone never creates these links.

PHASE 14 adds an intent form after each tool: selectors request a bounded equipment shortlist, the RPM calculator requests a kit calculation, and the compatibility table requests a compatibility check. Each submission has its own normalized CTA key and session/source attribution; the tool result itself is not changed or overstated.

The Sites/SQLite guidance influenced the implementation by preserving the existing Next.js structure and visual language, using indexes derived from actual public/workflow queries, and verifying those indexes with `EXPLAIN QUERY PLAN`.

## Verification

`tests/interactive-tools.test.mjs` covers:

- exact verified RPM rule, deterministic result and absence of a guessed fallback;
- human-only approval/publication and immutable rules;
- immediate suppression plus `STALE` after rights revocation;
- all three selectors, range/exact matching and exclusion of `SOURCED` facts;
- compatibility rows and every requested table column;
- actual SQLite index selection and clean migration 010 rollback.

Older rollback tests now remove migration 010 before their own migration.

## Deferred / human-gated

- applying migration 010 to a restored production backup and then production;
- importing or reviewing real cutting-speed assertions;
- mapping real product feature keys/units and resolving conflicts;
- creating real reviewed opportunities and choosing `INDEX` URLs;
- admin UI for candidates, rules, review, publication and stale queues;
- analytics events and commercial attribution — PHASE 18;
- real PHASE 13 semantic link sets and production migration 011;
- structured data assessment — PHASE 15.

# STOP / HUMAN REVIEW REQUIRED
