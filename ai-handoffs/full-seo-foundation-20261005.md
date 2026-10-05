# Full SEO foundation — handoff

- Исполнитель: Codex (`codex/full-seo-foundation-20261005`).
- База: `f4cf5d93fd714a5cba2b18be20c2d1d1cad5ca0a` — последний чистый commit в доступных рабочих ветках на момент старта.
- Цель: провести полный evidence-based аудит SEO и качества данных, реализовать безопасные P0/P1 исправления и автоматические quality gates без изменений production-сервисов.
- Область: фактическое приложение `design-exploration/staging-pilot/`, read-only аудит `7tool-source/` и этот handoff. Чужие worktree и грязная основная рабочая папка не изменяются.
- Критерий готовности: проектная карта и обязательные отчёты созданы; найденные P0 и выбранные безопасные P1 либо исправлены, либо документированы; релевантные тесты, lint, build, SEO/data checks выполнены; commit SHA и ограничения записаны здесь.
- Запрещено в рамках задачи: deploy, публикация feed, production migrations, Beget/DNS/cron/credentials, отправка лидов и любые внешние записи.

## Проверки

- `vinext build`: PASS.
- Full Node test suite: PASS, 370/370.
- `seo:check`: PASS, 23/23.
- `data:check`: PASS_WITH_QUARANTINE; 0 public draft leaks, 1 P0 product quarantined.
- ESLint: PASS, 0 errors; 1 existing `@next/next/no-img-element` warning for the Metrica noscript pixel.
- Raw `tsc --noEmit`: FAIL on broad pre-existing baseline (`.ts` imports, API response unions, Buffer BodyInit and other unrelated files); project did not previously expose a typecheck command, and production build passes.
- `git diff --check`: PASS (only Windows LF/CRLF notices).

## Ограничения

- Live `new.7tool.ru` остаётся preview: duplicate noindex response headers, `Disallow: /`, empty sitemap. Это намеренно и не менялось без launch approval.
- Supplier source still contains G1031 variants A8177/A8178/A8179 with Ø25 title versus 30/40/55 mm fact. Storefront quarantine is active; source correction remains manual/upstream.
- Brand/editorial routes, external webmaster tools, Merchant Center, analytics attribution, trustworthy lastmod and production cutover are documented backlog, not silently created.
- No deploy, feed publication, credentials, DNS, cron or live service changes were made.

## Commit

- Implementation commit: `50fcf5411d23ba84715e77450f1b45e7c32ad2f1` (`feat: add SEO data-quality foundation`).

## Review focus

Проверить соответствие schema/metadata видимым данным, политику indexation/canonical для параметров и пагинации, а также отсутствие ложных product facts.
