# Public trust and procurement pages — 2026-09-14

## Ownership

- Owner: Codex `/root`
- Branch: `codex/trust-content-pages`
- Base: `0910fd6` from `codex/home-category-conversion`
- Application: `design-exploration/staging-pilot`

## Goal

Add a factual public information layer around the storefront: company, contacts, payment, delivery, warranty and order process. Make those pages reachable from shared navigation without weakening catalog/search priority.

## Safety boundaries

- Use only facts already present in repository configuration or current feed-backed structures.
- Do not invent warehouses, carriers, service centres, project volumes, years in business, discounts, guarantees or payment terms.
- Do not publish incomplete tax or bank details.
- Do not send forms or messages externally and do not deploy without a separate explicit approval.

## Acceptance criteria

- Six public pages share the storefront header/footer and a consistent in-section navigation.
- Phone, email, Telegram and MAX use the canonical contact configuration.
- Payment, dispatch, warranty and order copy clearly distinguish public guidance from conditions that are confirmed in a commercial offer.
- Shared header and footer provide crawlable links without displacing catalog search on narrow screens.
- Focused tests, full lint, test suite and production build pass.

## Status

Implementation complete and kept local pending acceptance.

- Implementation commit: `917b944` (`feat: add public procurement information pages`).

## Implemented

- Added `/company`, `/contacts`, `/ordering`, `/payment`, `/delivery` and `/warranty` with unique metadata and a shared buyer-information navigation.
- Added a compact `Компания` entry to the desktop header without displacing search on narrower screens.
- Rebuilt the footer as a crawlable catalog, buyer-information and company navigation surface with canonical phone, email, Telegram and MAX links.
- Kept public company identity in the canonical contact configuration; contacts show only registration fields that are actually configured and never expose bank fields.
- Connected the payment page to the active quote-template VAT setting and the delivery page to the active cutoff/today-enabled shipping settings.
- Explained order, payment, dispatch and warranty as verification workflows; no unsupported warehouse, carrier, service-centre or project claims were added.
- Extended the release smoke matrix with all six public routes and added regression tests for route coverage, canonical contacts and forbidden unsupported claims.

## Verification

- Focused public-information tests: 3 passed, 0 failed.
- Full test suite: 177 passed, 0 failed.
- Full ESLint run: passed.
- Production build: passed.
- Release-candidate smoke against `http://127.0.0.1:3206`: 54 checks passed, including all six new public routes and protected staff redirects.
- No form was submitted and no external message was sent.

## Known limitation

- The repository has no confirmed public INN, KPP, OGRN or downloadable company card. The contacts page therefore omits empty registration fields and states that full bank details arrive in the issued account/contract. Add a download only after an approved source file is supplied.

## Local acceptance URLs

- `http://127.0.0.1:3206/company`
- `http://127.0.0.1:3206/contacts`
- `http://127.0.0.1:3206/ordering`
- `http://127.0.0.1:3206/payment`
- `http://127.0.0.1:3206/delivery`
- `http://127.0.0.1:3206/warranty`

## Release note

This branch has not been deployed. `test.7tool.ru` remains unchanged until a separate explicit deployment approval.
