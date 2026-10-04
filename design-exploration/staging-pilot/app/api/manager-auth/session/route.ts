import { createLocalAdminSession, clearLocalSessionCookie, localAdminCredentialsConfigured, localSessionCookie, verifyLocalAdminCredentials } from "../../../data/managerAccessServer.ts";
import { isTestManagerHostname } from "../../../data/managerAccess.ts";
import { createMemoryRateLimiter } from "../../../data/quoteRequestValidation.mjs";
import { effectiveRequestUrl, isSameOriginRequest } from "../../../data/requestOrigin.ts";

const limiter = createMemoryRateLimiter({ limit:8, windowMs:15 * 60 * 1000 });

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  if (!isTestManagerHostname(requestUrl.hostname)) return Response.json({ ok:false, message:"Вход сотрудников отключён для этого домена." }, { status:404 });
  if (!isSameOriginRequest(request, { requireOrigin:true })) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  const clientKey = request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
    || "loopback-admin-session";
  const rate = limiter.check(clientKey);
  if (!rate.allowed) return Response.json({ ok:false, message:"Слишком много попыток входа. Повторите позже." }, { status:429, headers:{ "Retry-After":String(rate.retryAfterSeconds) } });
  try {
    if (!localAdminCredentialsConfigured()) return Response.json({ ok:false, message:"Вход сотрудников пока не настроен." }, { status:503, headers:{ "Cache-Control":"no-store" } });
    const rawBody = await request.text();
    if (!rawBody || rawBody.length > 4096) return Response.json({ ok:false, message:"Укажите логин и пароль." }, { status:400, headers:{ "Cache-Control":"no-store" } });
    let credentials: { username?: unknown; password?: unknown };
    try {
      credentials = JSON.parse(rawBody) as { username?: unknown; password?: unknown };
    } catch {
      return Response.json({ ok:false, message:"Не удалось прочитать данные входа." }, { status:400, headers:{ "Cache-Control":"no-store" } });
    }
    if (!verifyLocalAdminCredentials(credentials.username, credentials.password)) {
      return Response.json({ ok:false, message:"Неверный логин или пароль." }, { status:401, headers:{ "Cache-Control":"no-store" } });
    }
    const session = await createLocalAdminSession();
    return Response.json({ ok:true, actor:session.actor }, {
      headers:{ "Cache-Control":"no-store", "Set-Cookie":localSessionCookie(session.token, effectiveRequestUrl(request), session.maxAge) },
    });
  } catch (error) {
    console.error("[quote-workspace] local admin session could not be created", error instanceof Error ? error.message : "unknown error");
    return Response.json({ ok:false, message:"Не удалось открыть локальную сессию администратора." }, { status:500 });
  }
}

export async function DELETE(request: Request) {
  const requestUrl = new URL(request.url);
  if (!isTestManagerHostname(requestUrl.hostname)) return Response.json({ ok:false }, { status:404 });
  if (!isSameOriginRequest(request, { requireOrigin:true })) return Response.json({ ok:false, message:"Запрос отклонён проверкой источника." }, { status:403 });
  return Response.json({ ok:true }, { headers:{ "Cache-Control":"no-store", "Set-Cookie":clearLocalSessionCookie(effectiveRequestUrl(request)) } });
}
