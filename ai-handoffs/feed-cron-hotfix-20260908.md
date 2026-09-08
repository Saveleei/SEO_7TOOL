# Feed cron hotfix 2026-09-08

- Agent: Codex
- Branch: `codex/feed-cron-hotfix-20260908`
- Goal: restore scheduled advertising-feed refresh and prevent feed imports from silently changing category presentation settings.
- Owned files: `scripts/hourly-refresh.sh`, `scripts/nightly-rebuild.sh`, `scripts/refresh-feed.mts`, `scripts/verify-category-settings.mjs`, `scripts/check-feed-health.mjs`.
- Production cron is backed up separately before mutation and will invoke shell scripts through `/bin/sh`.
- Verification: focused feed operations test, syntax checks, controlled production run, public XML probe.
- Known limitation: MAX token setup depends on bot moderation and portal access.
- Commit SHA: pending.
- Review focus: fail-closed category settings guard, feed cache freshness, public-feed health thresholds.
