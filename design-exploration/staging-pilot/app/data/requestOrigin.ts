type SameOriginOptions = { requireOrigin?: boolean };

export function isSameOriginRequest(request: Request, options: SameOriginOptions = {}): boolean {
  const originHeader = request.headers.get("origin");
  if (!originHeader) return !options.requireOrigin;

  let origin: string;
  try {
    origin = new URL(originHeader).origin;
  } catch {
    return false;
  }

  const acceptedOrigins = new Set([new URL(request.url).origin, effectiveRequestUrl(request).origin]);
  return acceptedOrigins.has(origin);
}

export function effectiveRequestUrl(request: Request): URL {
  const internalUrl = new URL(request.url);
  const forwardedProtocol = firstHeaderValue(request.headers.get("x-forwarded-proto")).toLowerCase();
  const host = request.headers.get("host")?.trim();
  if ((forwardedProtocol === "http" || forwardedProtocol === "https") && host) {
    try {
      return new URL(`${forwardedProtocol}://${host}${internalUrl.pathname}${internalUrl.search}`);
    } catch {
      return internalUrl;
    }
  }
  return internalUrl;
}

function firstHeaderValue(value: string | null): string {
  return String(value ?? "").split(",", 1)[0].trim();
}
