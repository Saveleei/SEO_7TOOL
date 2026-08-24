import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { retryLeadNotifications, updateLeadStatus } from "./actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  contact_form: "Контакты",
  cart_quote: "КП из корзины",
  one_click: "1 клик",
  price_match: "Нашли дешевле",
  product_quote: "КП по товару",
  equipment_selection: "Подбор оборудования",
  landing_quote: "Рекламная посадочная",
};

type LeadRow = {
  id: number; created_at: number; type: string;
  name: string | null; phone: string | null; email: string | null;
  company: string | null; inn: string | null; message: string | null;
  product_title: string | null; product_url: string | null;
  page_url: string | null; email_sent: number; email_error: string | null;
  max_sent: number; max_error: string | null;
  request_id: string | null; status: string; revenue: number | null;
  category: string | null; intent: string | null; yclid: string | null; client_id: string | null;
  uploaded_files: string | null;
  email_state: string | null; email_attempts: number | null; email_next_attempt_at: number | null;
  max_state: string | null; max_attempts: number | null; max_next_attempt_at: number | null;
  offline_summary: string | null;
};

type AttachedFile = { kind: "specification" | "requisites"; originalName: string; scanStatus: "quarantined" | "clean" };

function attachedFiles(value: string | null): AttachedFile[] {
  if (!value) return [];
  try { return JSON.parse(value) as AttachedFile[]; } catch { return []; }
}

function shortError(value: string | null): string | null {
  if (!value) return null;
  return value.length > 90 ? `${value.slice(0, 87)}…` : value;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const PAGE = 50;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE;
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (sp.type) { where.push("type = ?"); args.push(sp.type); }
  const wh = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (db().prepare(`SELECT COUNT(*) AS n FROM leads ${wh}`).get(...args) as { n: number }).n;
  const rows = db()
    .prepare<unknown[], LeadRow>(`SELECT id, created_at, type, name, phone, email, company, inn, message,
      product_title, product_url, page_url, email_sent, email_error, max_sent, max_error, request_id,
      status, revenue, category, intent, yclid, client_id, uploaded_files,
      (SELECT state FROM notification_outbox WHERE lead_id = leads.id AND channel = 'email') AS email_state,
      (SELECT attempt_count FROM notification_outbox WHERE lead_id = leads.id AND channel = 'email') AS email_attempts,
      (SELECT next_attempt_at FROM notification_outbox WHERE lead_id = leads.id AND channel = 'email') AS email_next_attempt_at,
      (SELECT state FROM notification_outbox WHERE lead_id = leads.id AND channel = 'max') AS max_state,
      (SELECT attempt_count FROM notification_outbox WHERE lead_id = leads.id AND channel = 'max') AS max_attempts,
      (SELECT next_attempt_at FROM notification_outbox WHERE lead_id = leads.id AND channel = 'max') AS max_next_attempt_at,
      (SELECT group_concat(target || ': ' || state || ' (' || attempt_count || ')', ', ')
       FROM offline_conversions WHERE lead_id = leads.id) AS offline_summary
      FROM leads ${wh} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...args, PAGE, offset);

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-extrabold tracking-tight text-steel-900 lg:text-[28px]">Заявки</h1>
          <p className="mt-1 text-[13px] text-steel-500">Всего: <b>{total.toLocaleString("ru-RU")}</b></p>
        </div>
        <form className="flex gap-2">
          <select name="type" defaultValue={sp.type ?? ""} className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[13px]">
            <option value="">Все типы</option>
            {Object.entries(TYPE_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
          <button className="rounded-md bg-amber-400 px-3 py-2 text-[12.5px] font-bold text-steel-900 shadow-amber hover:bg-amber-300">Фильтр</button>
          <a href="/api/admin/offline-conversions" className="inline-flex items-center rounded-md border border-steel-200 bg-white px-3 py-2 text-[12.5px] font-bold text-steel-700 hover:border-amber-400">Выгрузить конверсии</a>
        </form>
      </div>

      <div className="mt-6 overflow-x-auto rounded-[14px] border border-steel-200 bg-white shadow-soft">
        <table className="w-full text-[13px]">
          <thead className="bg-steel-50/60 text-[11px] uppercase tracking-[0.12em] text-steel-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">№</th>
              <th className="px-3 py-2 text-left font-semibold">Время (МСК)</th>
              <th className="px-3 py-2 text-left font-semibold">Тип</th>
              <th className="px-3 py-2 text-left font-semibold">Контакт</th>
              <th className="px-3 py-2 text-left font-semibold">Товар</th>
              <th className="px-3 py-2 text-left font-semibold">Сообщение</th>
              <th className="px-3 py-2 text-left font-semibold">Файлы</th>
              <th className="px-3 py-2 text-center font-semibold">Mail</th>
              <th className="px-3 py-2 text-center font-semibold">MAX</th>
              <th className="px-3 py-2 text-left font-semibold">Статус</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const files = attachedFiles(r.uploaded_files);
              return (
              <tr key={r.id} className="border-t border-steel-100 align-top">
                <td className="px-3 py-3 text-steel-500"><div>#{r.id}</div>{r.request_id && <div className="mt-1 whitespace-nowrap text-[10px] font-bold text-amber-700">{r.request_id}</div>}</td>
                <td className="px-3 py-3 whitespace-nowrap text-steel-700">
                  {new Date(r.created_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-200">
                    {TYPE_LABEL[r.type] ?? r.type}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="font-semibold text-steel-900">{r.name || "—"}</div>
                  {r.company && <div className="text-[12px] text-steel-500">{r.company}{r.inn ? ` · ИНН ${r.inn}` : ""}</div>}
                  {r.phone && <a href={`tel:${r.phone.replace(/\D/g, "")}`} className="block text-[12.5px] font-semibold text-amber-700 hover:underline">{r.phone}</a>}
                  {r.email && <a href={`mailto:${r.email}`} className="block text-[12.5px] text-steel-700 hover:text-amber-700">{r.email}</a>}
                </td>
                <td className="px-3 py-3">
                  {r.product_title ? (
                    <a href={r.product_url ?? "#"} target="_blank" className="text-[12.5px] text-steel-700 hover:text-amber-700">
                      {r.product_title}
                    </a>
                  ) : <span className="text-steel-400">—</span>}
                </td>
                <td className="max-w-[320px] whitespace-pre-wrap break-words px-3 py-3 text-[12.5px] text-steel-700">
                  {r.message || <span className="text-steel-400">—</span>}
                </td>
                <td className="px-3 py-3">
                  {files.length ? <div className="grid min-w-[140px] gap-1.5">{files.map((file, index) => (
                    <a key={`${file.originalName}-${index}`} href={`/api/admin/leads/${r.id}/files/${index}`} className="rounded border border-steel-200 bg-steel-50 px-2 py-1.5 text-[10.5px] font-bold text-steel-700 hover:border-amber-400">
                      {file.kind === "requisites" ? "Реквизиты" : "Спецификация"}: {file.originalName}
                      {file.scanStatus === "quarantined" && <span className="mt-0.5 block text-[9px] font-normal text-amber-800">Файл в карантине</span>}
                    </a>
                  ))}</div> : <span className="text-steel-400">—</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  {r.email_sent
                    ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-emerald-700 ring-1 ring-emerald-200">отпр.</span>
                    : r.email_error
                      ? <><span title={r.email_error} className="rounded bg-red-50 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-red-700 ring-1 ring-red-200">ошибка</span><div title={r.email_error} className="mt-1 max-w-[150px] text-left text-[9px] leading-tight text-red-700">{shortError(r.email_error)}</div></>
                      : <span className="rounded bg-steel-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-steel-500">в БД</span>}
                  {r.email_attempts != null && <div className="mt-1 text-[9px] text-steel-500">попыток: {r.email_attempts}{r.email_state === "failed" && r.email_next_attempt_at ? ` · повтор ${new Date(r.email_next_attempt_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}` : ""}</div>}
                </td>
                <td className="px-3 py-3 text-center">
                  {r.max_sent
                    ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-emerald-700 ring-1 ring-emerald-200">отпр.</span>
                    : r.max_error
                      ? <><span title={r.max_error} className="rounded bg-red-50 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-red-700 ring-1 ring-red-200">ошибка</span><div title={r.max_error} className="mt-1 max-w-[150px] text-left text-[9px] leading-tight text-red-700">{shortError(r.max_error)}</div></>
                      : <span className="rounded bg-steel-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase text-steel-500">в БД</span>}
                  {r.max_attempts != null && <div className="mt-1 text-[9px] text-steel-500">попыток: {r.max_attempts}{r.max_state === "failed" && r.max_next_attempt_at ? ` · повтор ${new Date(r.max_next_attempt_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}` : ""}</div>}
                </td>
                <td className="px-3 py-3">
                  <form action={updateLeadStatus} className="grid min-w-[150px] gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="status" defaultValue={r.status} className="rounded border border-steel-200 bg-white px-2 py-1.5 text-[11px]">
                      <option value="new">Новая</option><option value="contacted">Связались</option><option value="qualified">Квалифицирована</option><option value="won">Сделка</option><option value="lost">Закрыта</option><option value="spam">Спам</option><option value="duplicate">Дубль</option><option value="test">Тест</option>
                    </select>
                    <input name="revenue" type="number" min="0" defaultValue={r.revenue ?? ""} placeholder="Сумма, ₽" className="rounded border border-steel-200 px-2 py-1.5 text-[11px]" />
                    <button className="rounded bg-steel-900 px-2 py-1.5 text-[10px] font-bold text-white">Сохранить</button>
                    {(r.yclid || r.client_id) && <span className="text-[9px] text-emerald-700">Атрибуция сохранена</span>}
                    {r.offline_summary && <span className="text-[9px] text-steel-500">Офлайн: {r.offline_summary}</span>}
                  </form>
                  {(!r.email_sent || !r.max_sent) && (
                    <form action={retryLeadNotifications} className="mt-2">
                      <input type="hidden" name="id" value={r.id} />
                      <button className="w-full rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-900 hover:bg-amber-100">Повторить уведомления</button>
                    </form>
                  )}
                </td>
              </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-10 text-center text-steel-500">Заявок нет</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[11.5px] text-steel-500">
        SMTP {process.env.SMTP_HOST ? <b className="text-emerald-700">подключён</b> : <b className="text-red-700">не настроен</b>} · письма уходят на {process.env.LEADS_TO || "info@7tool.ru"}
        {" · "}MAX {process.env.MAX_BOT_TOKEN && (process.env.MAX_CHAT_ID || process.env.MAX_USER_ID) ? <b className="text-emerald-700">подключён</b> : <b className="text-red-700">не настроен</b>}
      </div>
    </section>
  );
}
