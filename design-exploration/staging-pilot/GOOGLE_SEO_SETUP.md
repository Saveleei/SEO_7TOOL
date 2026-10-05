# Google SEO Setup

Выполнять после production launch, не для закрытого preview.

1. Verify domain property, preferred HTTPS host and DNS ownership in Search Console.
2. Submit only `https://7tool.ru/sitemap.xml`; monitor discovered/indexed delta, Page indexing and Crawl stats.
3. Inspect the full route fixture set: home, `/c` category/subcategory, `/brand`, `/p` group/variant, retained product, noindex filter, P0 quarantine and 404; also test one priced/in-stock Product with Offer and one Product without Offer.
4. Validate Organization, WebSite, BreadcrumbList and Product JSON-LD with Rich Results Test. No review/rating schema without real reviews.
5. Connect Merchant Center only after website/feed parity checks. Feed must share SKU, URL, price, RUB currency, availability, image, brand and legal seller facts with storefront.
6. Configure GA4 ecommerce/conversion events without duplicating existing analytics; retain first-touch and conversion-page dimensions subject to consent.
7. Monitor Core Web Vitals by template (category/product/home), not only Lighthouse lab score; prioritize LCP image, CLS, INP and TTFB using field data.
8. Use URL Inspection for launch owners and important repaired URLs; do not request indexing for filters, search or quarantined products.
9. Validate that preserved `/c`, `/p`, `/brand` owners remain 200 and preview aliases resolve through exactly one server-side 308; compare submitted sitemap owners with Google-selected canonicals.
10. Review manual actions/security issues, merchant diagnostics and structured data errors weekly during launch month.
