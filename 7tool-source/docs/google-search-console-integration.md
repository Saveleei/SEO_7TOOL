# Google Search Console integration

The canonical implementation is documented in [Google SEO](./google-seo.md). PHASE 16 stores complete official API/export provenance and the exact daily `URL + query + country + device + search type` grain in migration 013.

PHASE 21 consumes only COMPLETE WEB runs whose declared period covers the refresh period. It selects a reviewed 7tool.ru property, never stores authorization headers or tokens, and uses the immutable rows for:

- clicks, impressions, CTR and impression-weighted average position;
- positions 6–20 quick wins;
- current versus previous query-set expansion;
- evidence-backed zero-impression and zero-click pruning checks.

The refresh engine does not call Search Console, retry APIs or scrape Google. Acquisition remains the credential-safe Phase 16 import workflow.

# STOP / HUMAN REVIEW REQUIRED
