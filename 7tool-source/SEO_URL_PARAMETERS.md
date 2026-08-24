# SEO URL Parameters — 7TOOL.ru

## Public page parameters

| Parameter | Type | User value | Indexing | Canonical | Sitemap | Yandex recommendation |
|---|---|---:|---|---|---|---|
| `page` on category/subcategory/brand | pagination | yes | index valid pages >1 | self-canonical | base pages only; discovery through links | do not clean/remove |
| category facet names, e.g. `Покрытие`, `Хвостовик`, `Серия` | filter | yes | `noindex, follow` until an explicit SEO landing decision | base category | exclude | configure as non-indexable filter parameters if they appear in crawl diagnostics |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` | tracking | attribution only | no separate indexing | clean canonical | exclude | `Clean-param` already configured |
| `yclid`, `gclid`, `_openstat` | tracking | attribution only | no separate indexing | clean canonical | exclude | `Clean-param` already configured |

Rules:

- Unsupported/empty `page`, `page=1` → canonical to base URL.
- `page` beyond the real last page → 404, not a duplicate of the last page.
- A URL combining `page` with a facet remains `noindex, follow` and canonicalizes to the base category until a separate intent page is approved.
- Filter/sort state must not create automatic indexable landing pages.

## API parameters

| Endpoint | Parameters | Policy |
|---|---|---|
| `/api/search` | `q` | functional, robots disallow, never in sitemap |
| `/api/live` | `p`, `v` hash lists | technical, robots disallow |
| `/api/cart`, `/api/favorites` | `ids` | functional, robots disallow |
| `/api/admin/**` | internal | auth + robots disallow |

## Admin parameters

`q`, `cat`, `brand`, `draft`, `nopr`, `noim`, `page`, `type`, `ok`, `err`, `next` are internal and covered by `/admin` disallow plus authentication. They are not canonical public URLs.

