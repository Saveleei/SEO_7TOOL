import { createLocalAdminSession, clearLocalSessionCookie, localSessionCookie } from "../../../data/managerAccessServer.ts";
import { isTestManagerHostname } from "../../../data/managerAccess.ts";
import { isQuoteTestModeEnabled } from "../../../data/quoteRequestStore.ts";
import { createMemoryRateLimiter } from "../../../data/quoteRequestValidation.mjs";

const limiter = createMemoryRateLimiter({ limit:12, windowMs:10 * 60 * 1000 });

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (!isQuoteTestModeEnabled() || !isTestManagerHostname(requestUrl.hostname)) return Response.json({ ok:false, message:"Тестовый вход отключён." }, { status:404 });
  if (request.headers.get("origin") !== requestUrl.origin) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "loopback-admin-session";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много попыток входа. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    const session = await createLocalAdminSession();
    return Response.json({ ok:true, actor:session.actor }, {
      headers:{ "Cache-Control":"no-store", "Set-Cookie":localSessionCookie(session.token, requestUrl, session.maxAge) },
    });
  } catch (error) {
    console.error("[quote-test] local admin session could not be created", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось открыть локальную сессию администратора." }, { status:500 });
  }
}

export async function DELETE(request: Request) {
  const requestUrl = new URL(request.url);
  if (!isQuoteTestModeEnabled() || !isTestManagerHostname(requestUrl.hostname)) return Response.json({ ok:false }, { status:404 });
  if (request.headers.get("origin") !== requestUrl.origin) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  return Response.json({ ok:true }, { headers:{ "Cache-Control":"no-store", "Set-Cookie":clearLocalSessionCookie(requestUrl) } });
}
