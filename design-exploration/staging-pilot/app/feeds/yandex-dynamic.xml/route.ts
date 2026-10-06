import { getCatalogBlockingProductIds } from "../../data/catalogQuality.ts";
import { getPublishedFeedCatalogSnapshot } from "../../data/feedCatalog.ts";
import { getCatalogSnapshotCompletedAt, getShippingRuntimeDiagnostic } from "../../data/shippingRuntimeSettings.mjs";
import { buildYandexAdvertisingFeed } from "../../data/yandexAdvertisingFeed.ts";

export const dynamic = "force-dynamic";

type FeedResponseDependencies = {
  snapshot?: ReturnType<typeof getPublishedFeedCatalogSnapshot>;
  blockedProductIds?: Set<string>;
  completedAt?: string;
  freshness?: { fresh: boolean; snapshotIdentityMatches: boolean };
};

export function createYandexAdvertisingFeedResponse(request: Request, method: "GET" | "HEAD" = "GET", dependencies: FeedResponseDependencies = {}): Response {
  try {
    const freshness = dependencies.freshness ?? getShippingRuntimeDiagnostic();
    if (!freshness.fresh || !freshness.snapshotIdentityMatches) return unavailableFeed();
    const completedAt = dependencies.completedAt ?? getCatalogSnapshotCompletedAt();
    if (!completedAt) return unavailableFeed();
    const build = buildYandexAdvertisingFeed({
      snapshot:dependencies.snapshot ?? getPublishedFeedCatalogSnapshot(),
      blockedProductIds:dependencies.blockedProductIds ?? getCatalogBlockingProductIds(),
      generatedAt:completedAt,
    });
    const headers = new Headers({
      "Content-Type":"application/xml; charset=utf-8",
      "Cache-Control":"public, max-age=300, stale-while-revalidate=600",
      "X-Robots-Tag":"noindex, follow",
      "X-Content-Type-Options":"nosniff",
      "X-7Tool-Catalog-Updated-At":completedAt,
      ETag:build.etag,
    });
    const modifiedAt = new Date(completedAt);
    if (Number.isFinite(modifiedAt.getTime())) headers.set("Last-Modified", modifiedAt.toUTCString());
    if (request.headers.get("if-none-match") === build.etag) return new Response(null, { status:304, headers });
    return new Response(method === "HEAD" ? null : build.xml, { status:200, headers });
  } catch {
    return unavailableFeed();
  }
}

export function GET(request: Request) {
  return createYandexAdvertisingFeedResponse(request);
}

export function HEAD(request: Request) {
  return createYandexAdvertisingFeedResponse(request, "HEAD");
}

function unavailableFeed(): Response {
  return new Response("Yandex advertising feed is temporarily unavailable.\n", {
    status:503,
    headers:{
      "Content-Type":"text/plain; charset=utf-8",
      "Cache-Control":"no-store",
      "Retry-After":"300",
      "X-Robots-Tag":"noindex, nofollow",
    },
  });
}
