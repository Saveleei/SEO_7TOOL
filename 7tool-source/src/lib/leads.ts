import "server-only";
import nodemailer from "nodemailer";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { saveLeadAttributionSnapshot } from "./lead-attribution.mjs";

export type LeadType =
  | "contact_form"
  | "cart_quote"
  | "product_quote"
  | "one_click"
  | "price_match"
  | "equipment_selection"
  | "landing_quote"
  | "content_request";

const TYPE_LABELS: Record<LeadType, string> = {
  contact_form: "Заявка с формы «Контакты»",
  cart_quote: "Заявка из корзины (КП)",
  product_quote: "Запрос коммерческого предложения по товару",
  one_click: "Купить в 1 клик",
  price_match: "«Нашли дешевле?»",
  equipment_selection: "Подбор оборудования",
  landing_quote: "Заявка с рекламной посадочной страницы",
  content_request: "Запрос из экспертного контента",
};

export type LeadPayload = {
  type: LeadType;
  submissionId?: string;
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  inn?: string;
  message?: string;
  productId?: string;
  variantId?: string;
  productTitle?: string;
  productUrl?: string;
  pageUrl?: string;
  articleId?: string;
  keywordClusterId?: string;
  category?: string;
  intent?: string;
  ctaKey?: string;
  extra?: Record<string, unknown>;
  uploadedFile?: string;
  uploadedFiles?: LeadUploadedFile[];
};

export type LeadUploadedFile = {
  kind: "specification" | "requisites";
  path: string;
  originalName: string;
  size: number;
  scanStatus: "quarantined" | "clean";
};

export type LeadContext = {
  ip?: string | null;
  userAgent?: string | null;
};

function requestId(): string {
  return `7T-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

type AttributionShape = {
  yclid?: string; internalClientId?: string; ymClientId?: string;
  firstTouch?: Record<string, unknown>; lastNonDirect?: Record<string, unknown>;
  landingPage?: string; referrer?: string; firstVisitAt?: string;
  sessionId?: string;
  // Legacy keys are read only to migrate existing browsers safely.
  clientId?: string;
};

export function saveLead(p: LeadPayload, ctx: LeadContext = {}) {
  const extra = p.extra ?? {};
  const attribution = (extra.attribution && typeof extra.attribution === "object" ? extra.attribution : {}) as AttributionShape;
  const submissionId = typeof p.submissionId === "string" && /^[A-Za-z0-9_-]{8,120}$/.test(p.submissionId)
    ? p.submissionId
    : null;
  if (submissionId) {
    const existing = db().prepare<unknown[], { id: number; request_id: string }>(
      "SELECT id, request_id FROM leads WHERE submission_id = ?",
    ).get(submissionId);
    if (existing) return { id: existing.id, requestId: existing.request_id, duplicate: true };
  }
  const firstTouch = attribution.firstTouch && typeof attribution.firstTouch === "object" ? attribution.firstTouch : undefined;
  const lastNonDirect = attribution.lastNonDirect && typeof attribution.lastNonDirect === "object" ? attribution.lastNonDirect : undefined;
  const activeTouch = lastNonDirect ?? firstTouch ?? {};
  const touchString = (key: string) => typeof activeTouch[key] === "string" ? String(activeTouch[key]).slice(0, 500) : null;
  const ymClientId = typeof attribution.ymClientId === "string" && /^\d{3,40}$/.test(attribution.ymClientId)
    ? attribution.ymClientId
    : null;
  const yclidCandidate = typeof activeTouch.yclid === "string" ? activeTouch.yclid : attribution.yclid;
  const yclid = typeof yclidCandidate === "string" && /^[A-Za-z0-9_-]{6,200}$/.test(yclidCandidate)
    ? yclidCandidate
    : null;
  const rid = requestId();
  const connection = db();
  const createdAt = Date.now();
  const save = connection.transaction(() => {
    const id = (connection
    .prepare(
      `INSERT INTO leads (
        created_at, type, name, phone, email, company, inn, message,
        product_id, product_title, product_url, page_url, ip, user_agent,
        payload, email_sent, request_id, status, category, intent, landing,
        yclid, client_id, utm_source, utm_medium, utm_campaign, utm_content,
        utm_term, uploaded_file, uploaded_files, internal_client_id, first_touch,
        last_non_direct, referrer, first_visit_at, variant_id, submission_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      createdAt,
      p.type,
      p.name ?? null,
      p.phone ?? null,
      p.email ?? null,
      p.company ?? null,
      p.inn ?? null,
      p.message ?? null,
      p.productId ?? null,
      p.productTitle ?? null,
      p.productUrl ?? null,
      p.pageUrl ?? null,
      ctx.ip ?? null,
      ctx.userAgent ?? null,
      p.extra ? JSON.stringify(p.extra) : null,
      rid,
      p.category ?? (typeof extra.category === "string" ? extra.category : null),
      p.intent ?? (typeof extra.intent === "string" ? extra.intent : null),
      typeof extra.landing === "string" ? extra.landing : null,
      yclid,
      ymClientId,
      touchString("utm_source"),
      touchString("utm_medium"),
      touchString("utm_campaign"),
      touchString("utm_content"),
      touchString("utm_term"),
      p.uploadedFile ?? null,
      p.uploadedFiles?.length ? JSON.stringify(p.uploadedFiles) : null,
      attribution.internalClientId ?? attribution.clientId ?? null,
      firstTouch ? JSON.stringify(firstTouch) : null,
      lastNonDirect ? JSON.stringify(lastNonDirect) : null,
      attribution.referrer ?? null,
      attribution.firstVisitAt ?? null,
      p.variantId ?? (typeof extra.variantId === "string" ? extra.variantId : null),
      submissionId,
    ).lastInsertRowid as number);
    saveLeadAttributionSnapshot(connection, {
      leadId: id, payload: p, extra, attribution, activeTouch, yclid, capturedAt: createdAt,
    });
    const now = Date.now();
    const enqueue = connection.prepare(
      "INSERT OR IGNORE INTO notification_outbox (lead_id, channel, state, next_attempt_at) VALUES (?, ?, 'pending', ?)",
    );
    enqueue.run(id, "email", now);
    enqueue.run(id, "max", now);
    return id;
  });
  try {
    const id = save();
    return { id, requestId: rid, duplicate: false };
  } catch (error) {
    if (submissionId) {
      const existing = connection.prepare<unknown[], { id: number; request_id: string }>(
        "SELECT id, request_id FROM leads WHERE submission_id = ?",
      ).get(submissionId);
      if (existing) return { id: existing.id, requestId: existing.request_id, duplicate: true };
    }
    throw error;
  }
}

export function markLeadEmailSent(id: number) {
  const now = Date.now();
  db().transaction(() => {
    db().prepare("UPDATE leads SET email_sent = 1, email_error = NULL, email_last_attempt_at = ? WHERE id = ?").run(now, id);
    db().prepare("UPDATE notification_outbox SET state = 'sent', attempt_count = attempt_count + 1, sent_at = ?, last_attempt_at = ?, last_error = NULL WHERE lead_id = ? AND channel = 'email'").run(now, now, id);
  })();
}

function notificationError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error || "Неизвестная ошибка")).slice(0, 1_000);
}

function markLeadEmailFailed(id: number, error: unknown) {
  const message = notificationError(error);
  markNotificationFailed(id, "email", message);
  console.error(`[lead:${id}] email notification failed: ${message}`);
}

function markLeadMaxSent(id: number) {
  const now = Date.now();
  db().transaction(() => {
    db().prepare("UPDATE leads SET max_sent = 1, max_error = NULL, max_last_attempt_at = ? WHERE id = ?").run(now, id);
    db().prepare("UPDATE notification_outbox SET state = 'sent', attempt_count = attempt_count + 1, sent_at = ?, last_attempt_at = ?, last_error = NULL WHERE lead_id = ? AND channel = 'max'").run(now, now, id);
  })();
}

function markLeadMaxFailed(id: number, error: unknown) {
  const message = notificationError(error);
  markNotificationFailed(id, "max", message);
  console.error(`[lead:${id}] MAX notification failed: ${message}`);
}

function markNotificationFailed(id: number, channel: "email" | "max", message: string) {
  const now = Date.now();
  const row = db().prepare<unknown[], { attempt_count: number }>(
    "SELECT attempt_count FROM notification_outbox WHERE lead_id = ? AND channel = ?",
  ).get(id, channel);
  const attempts = (row?.attempt_count ?? 0) + 1;
  const delays = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
  const nextAttempt = now + delays[Math.min(attempts - 1, delays.length - 1)];
  db().transaction(() => {
    if (channel === "email") {
      db().prepare("UPDATE leads SET email_sent = 0, email_error = ?, email_last_attempt_at = ? WHERE id = ?").run(message, now, id);
    } else {
      db().prepare("UPDATE leads SET max_sent = 0, max_error = ?, max_last_attempt_at = ? WHERE id = ?").run(message, now, id);
    }
    db().prepare(`
      INSERT INTO notification_outbox (lead_id, channel, state, attempt_count, next_attempt_at, last_attempt_at, last_error)
      VALUES (?, ?, 'failed', ?, ?, ?, ?)
      ON CONFLICT(lead_id, channel) DO UPDATE SET
        state = 'failed', attempt_count = excluded.attempt_count, next_attempt_at = excluded.next_attempt_at,
        last_attempt_at = excluded.last_attempt_at, last_error = excluded.last_error
    `).run(id, channel, attempts, nextAttempt, now, message);
  })();
}

let _transport: nodemailer.Transporter | null = null;
function getTransport(): nodemailer.Transporter | null {
  if (_transport) return _transport;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 0;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return null;
  _transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
  });
  return _transport;
}

function escape(s: string | undefined | null): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function notificationExtra(extra: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!extra) return undefined;
  const businessFields = Object.fromEntries(Object.entries(extra).filter(([key]) => key !== "attribution"));
  return Object.keys(businessFields).length ? businessFields : undefined;
}

export function renderLeadEmail(p: LeadPayload, leadId: number, ctx: LeadContext = {}): { subject: string; html: string; text: string } {
  const label = TYPE_LABELS[p.type] ?? p.type;
  const subject = p.productTitle
    ? `[7TOOL] ${label} · ${p.productTitle}`
    : `[7TOOL] ${label}`;
  const ts = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });

  const rows: [string, string | undefined | null][] = [
    ["Тип", label],
    ["Время (МСК)", ts],
    ["Имя", p.name],
    ["Телефон", p.phone],
    ["Email", p.email],
    ["Компания", p.company],
    ["ИНН", p.inn],
    ["Товар", p.productTitle],
    ["CTA", p.ctaKey],
    ["Материал", p.articleId],
    ["Кластер", p.keywordClusterId],
    ["Ссылка на товар", p.productUrl],
    ["Сообщение", p.message],
    ["Приложенные файлы", p.uploadedFiles?.map((file) => `${file.kind === "requisites" ? "Реквизиты" : "Спецификация"}: ${file.originalName}`).join("\n")],
    ["Параметры заявки", notificationExtra(p.extra) ? JSON.stringify(notificationExtra(p.extra), null, 2) : null],
    ["Страница-источник", p.pageUrl],
    ["IP", ctx.ip ?? null],
    ["UA", ctx.userAgent ?? null],
  ];

  const trs = rows
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => {
      const isUrl = String(v).startsWith("http") || String(v).startsWith("/");
      const cell = isUrl
        ? `<a href="${escape(String(v))}" style="color:#b45309">${escape(String(v))}</a>`
        : escape(String(v)).replace(/\n/g, "<br>");
      return `<tr><td style="padding:6px 12px;border-bottom:1px solid #e6eaee;color:#5d6770;font-size:12px;text-transform:uppercase;letter-spacing:.06em;width:160px;vertical-align:top">${escape(k)}</td><td style="padding:6px 12px;border-bottom:1px solid #e6eaee;color:#0f161b;font-size:14px">${cell}</td></tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="ru"><body style="margin:0;padding:24px;background:#f5f7f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table cellpadding="0" cellspacing="0" border="0" style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e6eaee;border-radius:14px;overflow:hidden">
    <tr><td style="padding:14px 20px;background:linear-gradient(90deg,#fbbf24,#f59e0b,#fcd34d);color:#0f161b;font-weight:800;letter-spacing:.18em;text-transform:uppercase;font-size:12px">7TOOL · Новая заявка #${leadId}</td></tr>
    <tr><td style="padding:18px 20px 8px"><div style="font-size:18px;font-weight:800;color:#0f161b">${escape(label)}</div></td></tr>
    <tr><td style="padding:0 20px 18px"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #e6eaee">${trs}</table></td></tr>
    <tr><td style="padding:12px 20px;background:#f5f7f8;color:#5d6770;font-size:12px">Ответьте по телефону или email клиента. Лид #${leadId} · ${escape(ts)} МСК</td></tr>
  </table>
</body></html>`;

  const lines = rows
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const text = `${label}\n\n${lines}\n\n— 7TOOL admin · #${leadId}`;
  return { subject, html, text };
}

export async function sendLeadEmail(p: LeadPayload, leadId: number, ctx: LeadContext = {}): Promise<{ ok: boolean; error?: string }> {
  const transport = getTransport();
  if (!transport) {
    const error = "SMTP не настроен: проверьте SMTP_HOST, SMTP_PORT, SMTP_USER и SMTP_PASS";
    markLeadEmailFailed(leadId, error);
    return { ok: false, error };
  }
  const to = process.env.LEADS_TO || "info@7tool.ru";
  const from = process.env.LEADS_FROM || process.env.SMTP_USER || "info@7tool.ru";
  const { subject, html, text } = renderLeadEmail(p, leadId, ctx);
  try {
    const info = await transport.sendMail({ from, to, subject, html, text, replyTo: p.email || undefined });
    markLeadEmailSent(leadId);
    db().prepare("UPDATE notification_outbox SET provider_message_id = ?, provider_response = ? WHERE lead_id = ? AND channel = 'email'")
      .run(info.messageId || null, String(info.response || "").slice(0, 1_000) || null, leadId);
    return { ok: true };
  } catch (e) {
    const error = notificationError(e);
    markLeadEmailFailed(leadId, error);
    return { ok: false, error };
  }
}

function maxRecipient(): { key: "chat_id" | "user_id"; id: string } | null {
  const chatId = process.env.MAX_CHAT_ID?.trim();
  if (chatId && /^-?\d+$/.test(chatId)) return { key: "chat_id", id: chatId };
  const userId = process.env.MAX_USER_ID?.trim();
  if (userId && /^\d+$/.test(userId)) return { key: "user_id", id: userId };
  return null;
}

function renderLeadMax(p: LeadPayload, leadId: number): string {
  const label = TYPE_LABELS[p.type] ?? p.type;
  const ts = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
  const rows: [string, string | undefined | null, number][] = [
    ["Тип", label, 160],
    ["Время (МСК)", ts, 80],
    ["Имя", p.name, 160],
    ["Телефон", p.phone, 80],
    ["Email", p.email, 180],
    ["Компания", p.company, 220],
    ["ИНН", p.inn, 40],
    ["Товар", p.productTitle, 500],
    ["Сообщение", p.message, 1_200],
    ["Параметры", notificationExtra(p.extra) ? JSON.stringify(notificationExtra(p.extra)) : null, 900],
    ["Товар на сайте", p.productUrl, 500],
    ["Страница заявки", p.pageUrl, 500],
  ];
  const lines = rows
    .filter(([, value]) => value && String(value).trim())
    .map(([key, value, limit]) => `${key}: ${String(value).slice(0, limit)}`);
  let message = `🟠 7TOOL · Новая заявка #${leadId}`;
  for (const line of lines) {
    const remaining = 3_950 - message.length - 1;
    if (remaining <= 0) break;
    message += `\n${line.slice(0, remaining)}`;
  }
  return message;
}

export async function sendLeadMax(p: LeadPayload, leadId: number): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.MAX_BOT_TOKEN?.trim();
  const recipient = maxRecipient();
  if (!token || !recipient) {
    const error = "MAX не настроен: нужны MAX_BOT_TOKEN и MAX_CHAT_ID либо MAX_USER_ID";
    markLeadMaxFailed(leadId, error);
    return { ok: false, error };
  }

  const endpoint = new URL("https://platform-api2.max.ru/messages");
  endpoint.searchParams.set(recipient.key, recipient.id);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: renderLeadMax(p, leadId), notify: true }),
      signal: controller.signal,
    });
    const responseBody = (await response.text()).replace(/\s+/g, " ").slice(0, 1_000);
    if (!response.ok) {
      const body = responseBody.slice(0, 500);
      throw new Error(`MAX API HTTP ${response.status}${body ? `: ${body}` : ""}`);
    }
    markLeadMaxSent(leadId);
    let messageId: string | null = null;
    try {
      const parsed = JSON.parse(responseBody) as { message?: { body?: { mid?: string } }; message_id?: string };
      messageId = parsed.message_id || parsed.message?.body?.mid || null;
    } catch { /* ответ может быть пустым */ }
    db().prepare("UPDATE notification_outbox SET provider_message_id = ?, provider_response = ? WHERE lead_id = ? AND channel = 'max'")
      .run(messageId, responseBody || null, leadId);
    return { ok: true };
  } catch (error) {
    const message = notificationError(error);
    markLeadMaxFailed(leadId, message);
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

type StoredLead = {
  id: number; type: LeadType; name: string | null; phone: string | null; email: string | null;
  company: string | null; inn: string | null; message: string | null; product_id: string | null;
  product_title: string | null; product_url: string | null; page_url: string | null; payload: string | null;
  uploaded_file: string | null; uploaded_files: string | null; ip: string | null; user_agent: string | null;
  email_sent: number; max_sent: number;
};

function parseObject(value: string | null): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

function parseFiles(value: string | null): LeadUploadedFile[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as LeadUploadedFile[] : undefined;
  } catch { return undefined; }
}

export async function retryLeadNotifications(leadId: number): Promise<{ email: boolean; max: boolean } | null> {
  const row = db().prepare<unknown[], StoredLead>(`
    SELECT id, type, name, phone, email, company, inn, message, product_id, product_title,
      product_url, page_url, payload, uploaded_file, uploaded_files, ip, user_agent, email_sent, max_sent
    FROM leads WHERE id = ?
  `).get(leadId);
  if (!row) return null;
  const payload: LeadPayload = {
    type: row.type,
    name: row.name ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    company: row.company ?? undefined,
    inn: row.inn ?? undefined,
    message: row.message ?? undefined,
    productId: row.product_id ?? undefined,
    productTitle: row.product_title ?? undefined,
    productUrl: row.product_url ?? undefined,
    pageUrl: row.page_url ?? undefined,
    extra: parseObject(row.payload),
    uploadedFile: row.uploaded_file ?? undefined,
    uploadedFiles: parseFiles(row.uploaded_files),
  };
  const ctx: LeadContext = { ip: row.ip, userAgent: row.user_agent };
  const [email, max] = await Promise.all([
    row.email_sent ? Promise.resolve({ ok: true }) : sendLeadEmail(payload, leadId, ctx),
    row.max_sent ? Promise.resolve({ ok: true }) : sendLeadMax(payload, leadId),
  ]);
  return { email: email.ok, max: max.ok };
}

export async function submitLead(p: LeadPayload, ctx: LeadContext = {}): Promise<{ ok: true; id: number; requestId: string; emailed: boolean; maxed: boolean; duplicate: boolean }> {
  const { id, requestId, duplicate } = saveLead(p, ctx);
  const row = db().prepare<unknown[], { email_sent: number; max_sent: number }>("SELECT email_sent, max_sent FROM leads WHERE id = ?").get(id);
  // HTTP-запрос подтверждает сохранение заявки и не ждёт внешние SMTP/MAX.
  // Каналы обрабатывает защищённый outbox-worker; это исключает потерю ответа
  // пользователю при зависшем SMTP и сохраняет управляемые повторы.
  return { ok: true, id, requestId, emailed: Boolean(row?.email_sent), maxed: Boolean(row?.max_sent), duplicate };
}

export async function processDueNotifications(limit = 20): Promise<{ processed: number; sent: number; failed: number }> {
  const due = db().prepare<unknown[], { lead_id: number; channel: "email" | "max" }>(`
    SELECT lead_id, channel FROM notification_outbox
    WHERE ((state IN ('pending', 'failed') AND next_attempt_at <= ?)
      OR (state = 'processing' AND last_attempt_at <= ?))
      AND attempt_count < 12
    ORDER BY next_attempt_at ASC LIMIT ?
  `).all(Date.now(), Date.now() - 5 * 60_000, Math.max(1, Math.min(limit, 100)));
  let sent = 0;
  let failed = 0;
  for (const item of due) {
    const claimed = db().prepare(`UPDATE notification_outbox SET state = 'processing', last_attempt_at = ?
      WHERE lead_id = ? AND channel = ? AND ((state IN ('pending', 'failed') AND next_attempt_at <= ?)
        OR (state = 'processing' AND last_attempt_at <= ?))`)
      .run(Date.now(), item.lead_id, item.channel, Date.now(), Date.now() - 5 * 60_000);
    if (!claimed.changes) continue;
    const row = db().prepare<unknown[], StoredLead>(`
      SELECT id, type, name, phone, email, company, inn, message, product_id, product_title,
        product_url, page_url, payload, uploaded_file, uploaded_files, ip, user_agent, email_sent, max_sent
      FROM leads WHERE id = ?
    `).get(item.lead_id);
    if (!row) {
      markNotificationFailed(item.lead_id, item.channel, "Заявка для уведомления не найдена");
      failed += 1;
      continue;
    }
    const payload: LeadPayload = {
      type: row.type, name: row.name ?? undefined, phone: row.phone ?? undefined, email: row.email ?? undefined,
      company: row.company ?? undefined, inn: row.inn ?? undefined, message: row.message ?? undefined,
      productId: row.product_id ?? undefined, productTitle: row.product_title ?? undefined,
      productUrl: row.product_url ?? undefined, pageUrl: row.page_url ?? undefined,
      extra: parseObject(row.payload), uploadedFile: row.uploaded_file ?? undefined, uploadedFiles: parseFiles(row.uploaded_files),
    };
    const result = item.channel === "email"
      ? await sendLeadEmail(payload, row.id, { ip: row.ip, userAgent: row.user_agent })
      : await sendLeadMax(payload, row.id);
    if (result.ok) sent += 1; else failed += 1;
  }
  return { processed: due.length, sent, failed };
}
