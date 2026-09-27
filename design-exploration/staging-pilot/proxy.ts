import { NextResponse } from "next/server.js";
import { applySecurityResponseHeaders } from "./app/data/securityHeaders.mjs";
import { SEO_NOINDEX_HEADER, shouldSendNoIndexHeader } from "./app/data/seoIndexing.mjs";

export function proxy(request?: { headers?: Headers; nextUrl?: { hostname?: string } }) {
  const response = NextResponse.next();
  applySecurityResponseHeaders(response.headers);
  const host = request?.nextUrl?.hostname ?? request?.headers?.get("host") ?? "";
  if (shouldSendNoIndexHeader(host)) response.headers.set("X-Robots-Tag", SEO_NOINDEX_HEADER);
  return response;
}

export const config = {
  matcher:["/((?!_next/static|_next/image|favicon.ico).*)"],
};
