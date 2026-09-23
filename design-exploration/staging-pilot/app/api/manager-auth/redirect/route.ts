import { isTestManagerHostname, requestHostname, safePreviewReturnTo } from "../../../data/managerAccess.ts";
import { isQuoteTestModeEnabled } from "../../../data/quoteRequestStore.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  if (!isQuoteTestModeEnabled() || !isTestManagerHostname(requestHostname(request.headers))) {
    return new Response(null, { status:404, headers:{ "Cache-Control":"no-store" } });
  }
  const returnTo = safePreviewReturnTo(request.headers.get("x-7tool-return-to"));
  return new Response(null, {
    status:302,
    headers:{
      "Cache-Control":"no-store",
      Location:`/test/access?returnTo=${encodeURIComponent(returnTo)}`,
    },
  });
}
