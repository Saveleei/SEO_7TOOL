# Legacy URL preservation and SEO completion — handoff

- Исполнитель: Codex.
- Ветка: `codex/legacy-url-redirects-20261005`.
- База: `44cf5e8`.
- Область: `design-exploration/staging-pilot/` и этот handoff.
- Production deployment, feed publication, Beget/DNS/credentials не выполнялись.

## Outcome

- Frozen live sitemap 7tool.ru: 18 544/18 544 URL классифицированы; gaps/collisions = 0.
- Существующие `/c`, `/c/category/subcategory`, `/p`, `/brand` сохранены как 200 self-canonical owners.
- Preview aliases `/catalog/category` и `/product` дают one-hop 308 на `/c` и `/p`, сохраняя query.
- Точные legacy product-variant slugs воспроизводятся детерминированно; историческая HML5 collision разрешается в пользу group route.
- Добавлены 125 subcategory pages, 87 brand hubs и 51 retained factual product page для live URL, которых нет в текущем feed.
- Sitemap: 19 336 canonical URL, из них 149 `/c`, 19 082 `/p`, 87 `/brand`, 18 static; 18 323 product entries содержат images. Пять P0-conflict routes G1031 исключены намеренно.
- Добавлены CollectionPage/ItemList, custom 404, legal/info pages, consent links, Web Vitals event и корректная аналитика `/c`/`/p`.
- Обязательные SEO документы актуализированы; 50-темный content plan сохранён как editorial backlog, без массовой публикации.

## Verification

- Full tests: 377/377 passed.
- SEO tests: 32/32 passed; frozen coverage audit: zero gaps.
- Data check: `PASS_WITH_QUARANTINE`; 0 public draft leaks, 1 quarantined P0 product.
- ESLint: exit 0; 1 existing `@next/next/no-img-element` warning in Yandex Metrika noscript pixel.
- Vinext production build: passed.
- Raw `tsc --noEmit`: not a supported project command; failed on pre-existing Vinext/API import and typing baseline. Supported build passed.
- `git diff --check`: passed; only Git CRLF conversion notices.
- Local production smoke: `/`, category, subcategory, product and brand = 200; old preview aliases = 308 with exact destination/query; unknown route = 404. Canonical and JSON-LD were present in server HTML.

## Remaining launch gates

1. Correct G1031 in supplier source and rerun generation/checks.
2. Owner must confirm legal seller, NAP, INN/KPP/OGRN and final privacy/consent wording.
3. Decide lifecycle for 51 retained published products: restore to feed, approved replacement/redirect, or honest discontinued handling.
4. At cutover only: enable indexing for exact `7tool.ru`, verify reverse-proxy headers/robots/sitemap before DNS/proxy switch.
5. After launch: Webmaster/Search Console/Metrica/Merchant Center setup, rich-results validation, field CWV/index coverage/redirect monitoring.

## Review focus

- Exact variant URL mapping and HML5 collision behavior.
- No `/product` or `/catalog/category` internal navigation.
- Retained pages do not emit stale Offer/availability.
- P0 quarantine stays excluded from sitemap/Product JSON-LD.
- Legal facts remain explicitly blocked from final publication until owner confirmation.

## Commit

This handoff is committed with the implementation on `codex/legacy-url-redirects-20261005`.
