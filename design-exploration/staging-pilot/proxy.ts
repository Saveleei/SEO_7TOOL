import { NextResponse } from "next/server.js";
import { applySecurityResponseHeaders } from "./app/data/securityHeaders.mjs";

export function proxy() {
  const response = NextResponse.next();
  applySecurityResponseHeaders(response.headers);
  return response;
}

export const config = {
  matcher:["/((?!_next/static|_next/image|favicon.ico).*)"],
};
