# Deprecated Data Report

## Проверенные зоны

Components, route templates, JSON-LD, APIs, static/config/manifest/deployment files, feeds and tests were scanned for phone, email, address, company name, old domains and hardcoded commercial claims.

## Findings

| Finding | Severity | Status/action |
|---|---|---|
| Footer обещал «гарантия 12 месяцев» всем товарам, warranty page говорит об условиях конкретного товара | P1 | исправлено на фактическую формулировку |
| Organization/public requisites contain `ООО «7TOOL»`, address/phone/email, but INN/KPP/OGRN are empty | P1 | заполнить только по подтверждённым документам |
| Advertising feed refers to `ООО «К2 ТУЛ»` | P1 | юридическая сверка до feed publication |
| Contact facts originate from more than one model/file | P1 | объединить в один immutable company facts source |
| `7tool.ru` hardcoded in canonical/schema allowlist | not deprecated | intentional production origin; не заменять на preview host |
| Legacy route aliases | not deprecated | preserved as permanent redirects |
| Duplicate email occurrences | P2 | допустимо при одном source value; покрыть parity test |

No secrets or credentials were printed or modified. No live deployment configuration was changed.
