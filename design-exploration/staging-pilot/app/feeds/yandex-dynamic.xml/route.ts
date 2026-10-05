const YANDEX_FEED_UPSTREAM = "http://127.0.0.1:3108/feeds/yandex-dynamic.xml";

export const dynamic = "force-dynamic";

export async function proxyYandexAdvertisingFeed(fetchImpl: typeof fetch = fetch, method: "GET" | "HEAD" = "GET"): Promise<Response> {
  try {
    const upstream = await fetchImpl(YANDEX_FEED_UPSTREAM, {
      method,
      cache:"no-store",
      redirect:"error",
      headers:{ Accept:"application/xml,text/xml;q=0.9,*/*;q=0.1", "User-Agent":"7tool-storefront-feed-bridge/1.0" },
      signal:AbortSignal.timeout(20_000),
    });
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !/^(?:application|text)\/xml\b/iu.test(contentType)) return unavailableFeed();
    const headers = new Headers({
      "Content-Type":contentType,
      "Cache-Control":"public, max-age=300, stale-while-revalidate=600",
      "X-Robots-Tag":"noindex, follow",
      "X-Content-Type-Options":"nosniff",
    });
    for (const name of ["content-length", "etag", "last-modified"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(method === "HEAD" ? null : upstream.body, { status:200, headers });
  } catch {
    return unavailableFeed();
  }
}

export function GET() {
  return proxyYandexAdvertisingFeed();
}

export function HEAD() {
  return proxyYandexAdvertisingFeed(fetch, "HEAD");
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
