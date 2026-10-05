import { NextResponse } from "next/server.js";
import { applySecurityResponseHeaders } from "./app/data/securityHeaders.mjs";
import { SEO_NOINDEX_HEADER, shouldSendNoIndexHeader } from "./app/data/seoIndexing.mjs";

type ProxyRequest = {
  headers?: Headers;
  nextUrl?: { hostname?: string; pathname?: string; search?: string };
};

export function proxy(request?: ProxyRequest) {
  const host = request?.nextUrl?.hostname ?? request?.headers?.get("host") ?? "";
  const pathname = request?.nextUrl?.pathname ?? "";
  const destinationPath = pathname.startsWith("/product/")
    ? `/p/${pathname.slice("/product/".length)}`
    : pathname.startsWith("/catalog/category/")
      ? `/c/${pathname.slice("/catalog/category/".length)}`
      : "";
  const response = destinationPath
    ? NextResponse.redirect(new URL(`${destinationPath}${request?.nextUrl?.search ?? ""}`, `https://${host || "7tool.ru"}`), 308)
    : NextResponse.next();
  applySecurityResponseHeaders(response.headers);
  if (shouldSendNoIndexHeader(host)) response.headers.set("X-Robots-Tag", SEO_NOINDEX_HEADER);
  return response;
}

export const config = {
  matcher:["/((?!_next/static|_next/image|favicon.ico).*)"],
};
