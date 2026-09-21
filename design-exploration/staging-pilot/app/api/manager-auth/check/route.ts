import { isTestManagerHostname, requestHostname } from "../../../data/managerAccess.ts";
import { resolveLocalManagerActor } from "../../../data/managerAccessServer.ts";
import { isQuoteTestModeEnabled } from "../../../data/quoteRequestStore.ts";

export async function GET(request: Request) {
  if (!isQuoteTestModeEnabled() || !isTestManagerHostname(requestHostname(request.headers))) {
    return new Response(null, { status:404, headers:{ "Cache-Control":"no-store" } });
  }
  const actor = await resolveLocalManagerActor(request.headers);
  return new Response(null, { status:actor ? 204 : 401, headers:{ "Cache-Control":"no-store" } });
}
