import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "7tool_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname === "/admin/login";
  const protectedPath =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!protectedPath || isLogin) return NextResponse.next();

  const tok = req.cookies.get(COOKIE)?.value;
  if (!tok) {
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
