"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { QuoteApprovalEvent, QuoteApprovalState } from "../data/quoteApprovalStore";

const checks = [
  ["product_identity", "Товар, исполнение и артикул сверены"],
  ["price_and_discount", "Цена и скидка подтверждены"],
  ["supply_and_timing", "Наличие и срок поставки подтверждены"],
  ["payment_and_delivery", "Оплата и доставка заполнены"],
  ["vat_and_total", "Ставка НДС и итоговая сумма проверены"],
  ["recipient", "Получатель и его контакты проверены"],
  ["documents", "Документы и гарантийные условия согласованы"],
] as const;

const stageLabels: Record<QuoteApprovalState["stage"], string> = {
  not_submitted:"Не передано",
  submitted:"На согласовании",
  changes_requested:"Нужна новая редакция",
  approved:"Утверждено",
  delivery_prepared:"Пакет подготовлен",
};

type Props = {
  requestId: string;
  quoteId: string;
  revision: number;
  quoteStatus: "draft" | "ready";
  senderName: string;
  senderRole: string;
  recipientEmail: string;
  initialState: QuoteApprovalState;
};

export function QuoteApprovalPanel({ requestId, quoteId, revision, quoteStatus, senderName, senderRole, recipientEmail, initialState }: Props) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerRole, setReviewerRole] = useState("");
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<"email" | "telegram" | "max">("email");
  const [recipient, setRecipient] = useState(recipientEmail);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const allConfirmed = checks.every(([key]) => confirmed[key]);

  async function act(payload: Record<string, unknown>, successMessage: string) {
    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/quote-requests/${encodeURIComponent(requestId)}/quote-approval`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ ...payload, revision, idempotencyKey:crypto.randomUUID() }),
      });
      const result = await response.json() as { ok?: boolean; message?: string; state?: QuoteApprovalState };
      if (!response.ok || !result.ok || !result.state) throw new Error(result.message || "Действие не сохранено.");
      setState(result.state);
      setMessage(successMessage);
      setNote("");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Действие не сохранено.");
    } finally {
      setPending(false);
    }
  }

  function chooseChannel(nextChannel: "email" | "telegram" | "max") {
    setChannel(nextChannel);
    setRecipient(nextChannel === "email" ? recipientEmail : "");
  }

  const readyForWorkflow = revision > 0 && quoteStatus === "ready";
  return <section className="quote-approval-panel" id="quote-approval" aria-labelledby="quote-approval-title">
    <header>
      <div><p className="eyebrow">Внутренний контроль</p><h2 id="quote-approval-title">Согласование редакции №{revision || "—"}</h2><p>Решение относится только к этой сохранённой версии {quoteId}. Изменения оформляются новой редакцией.</p></div>
      <span className={`quote-approval-stage is-${state.stage}`}>{stageLabels[state.stage]}</span>
    </header>

    {!readyForWorkflow && <div className="quote-approval-notice"><b>Сначала сохраните готовую редакцию</b><p>Заполните подтверждённые сроки, оплату и доставку, затем нажмите «Готово к согласованию».</p></div>}

    {readyForWorkflow && state.stage === "not_submitted" && <div className="quote-approval-content">
      <fieldset className="quote-preflight"><legend>Проверка перед согласованием</legend><p>Каждый пункт подтверждается вручную — это защита от неверной цены, срока или комплектации.</p><div>{checks.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(confirmed[key])} onChange={(event) => setConfirmed((current) => ({ ...current, [key]:event.target.checked }))} /><span>{label}</span></label>)}</div></fieldset>
      <div className="quote-approval-action"><span>Передаёт на согласование</span><b>{senderName}</b><p>{senderRole}</p><button type="button" disabled={pending || !allConfirmed} onClick={() => act({ type:"submitted", actorName:senderName, actorRole:senderRole, checks:confirmed }, `Редакция №${revision} передана на согласование.`)}>{pending ? "Сохраняем…" : `Передать редакцию №${revision}`}</button><small>После передачи состав документа и контрольная сумма этой редакции фиксируются в истории.</small></div>
    </div>}

    {readyForWorkflow && state.stage === "submitted" && <div className="quote-approval-content">
      <div className="quote-review-fields"><h3>Решение согласующего</h3><p>Укажите реального сотрудника, который проверил коммерческие условия.</p><label><span>ФИО</span><input value={reviewerName} maxLength={100} onChange={(event) => setReviewerName(event.target.value)} /></label><label><span>Должность / роль</span><input value={reviewerRole} maxLength={120} onChange={(event) => setReviewerRole(event.target.value)} /></label><label className="wide"><span>Комментарий</span><textarea rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Обязателен при возврате на доработку" /></label></div>
      <div className="quote-decision-actions"><button type="button" disabled={pending || reviewerName.trim().length < 2 || reviewerRole.trim().length < 2} onClick={() => act({ type:"approved", actorName:reviewerName, actorRole:reviewerRole, note }, `Редакция №${revision} утверждена.`)}>{pending ? "Сохраняем…" : "Утвердить редакцию"}</button><button className="secondary" type="button" disabled={pending || reviewerName.trim().length < 2 || reviewerRole.trim().length < 2 || note.trim().length < 3} onClick={() => act({ type:"changes_requested", actorName:reviewerName, actorRole:reviewerRole, note }, "Редакция возвращена на доработку.")}>Вернуть на доработку</button><small>Возврат не изменяет текущий документ. Менеджер создаёт новую редакцию.</small></div>
    </div>}

    {readyForWorkflow && state.stage === "changes_requested" && <div className="quote-approval-notice is-warning"><b>Нужна новая редакция</b><p>{latestEvent(state.events)?.note || "Согласующий запросил изменения."} Исправьте данные выше и сохраните новое КП.</p></div>}

    {readyForWorkflow && state.stage === "approved" && <div className="quote-approval-content">
      <div className="quote-delivery-fields"><h3>Подготовить пакет отправки</h3><p>Зафиксируем канал и получателя. Сайт ничего не отправит автоматически.</p><label><span>Канал</span><select value={channel} onChange={(event) => chooseChannel(event.target.value as typeof channel)}><option value="email">Электронная почта</option><option value="telegram">Telegram</option><option value="max">MAX</option></select></label><label><span>{channel === "email" ? "Email получателя" : channel === "telegram" ? "Username или ссылка Telegram" : "Ссылка MAX"}</span><input value={recipient} maxLength={180} onChange={(event) => setRecipient(event.target.value)} placeholder={channel === "email" ? "client@company.ru" : channel === "telegram" ? "@username" : "https://max.ru/..."} /></label></div>
      <div className="quote-approval-action"><span>Подготавливает</span><b>{senderName}</b><p>{senderRole}</p><button type="button" disabled={pending || recipient.trim().length < 5} onClick={() => act({ type:"delivery_prepared", actorName:senderName, actorRole:senderRole, channel, recipient }, "Пакет отправки подготовлен локально.")}>{pending ? "Сохраняем…" : "Подготовить пакет"}</button><small>Это контрольная точка, а не отправка письма или сообщения.</small></div>
    </div>}

    {readyForWorkflow && state.stage === "delivery_prepared" && <DeliveryPrepared event={latestEvent(state.events)} requestId={requestId} revision={revision} />}

    {state.events.length > 0 && <div className="quote-approval-history"><h3>История редакции</h3><ol>{state.events.map((event) => <li key={event.id}><span>{eventLabel(event)}</span><div><b>{event.actorName}</b><small>{event.actorRole} · {formatDate(event.createdAt)}</small>{event.note && <p>{event.note}</p>}</div></li>)}</ol><p>Контрольная сумма: <code>{state.quoteFingerprint}</code></p></div>}
    <div className="quote-approval-feedback" aria-live="polite">{error ? <p className="error">{error}</p> : message ? <p className="success">{message}</p> : null}</div>
  </section>;
}

function DeliveryPrepared({ event, requestId, revision }: { event: QuoteApprovalEvent | undefined; requestId: string; revision: number }) {
  if (!event) return null;
  return <div className="quote-delivery-ready"><div><span>Имя файла для сохранения</span><h3>{event.deliveryFileName}</h3><p>{channelLabel(event.channel)} · {event.recipient}</p></div><a href={`/test/requests/${requestId}/quote?mode=preview&revision=${revision}`}>Открыть зафиксированную версию для печати</a><small>PDF ещё не создан: используйте системную печать → «Сохранить как PDF». Автоматической отправки нет.</small></div>;
}

function latestEvent(events: QuoteApprovalEvent[]) {
  return events.at(-1);
}

function eventLabel(event: QuoteApprovalEvent) {
  if (event.type === "submitted") return "Передано";
  if (event.type === "approved") return "Утверждено";
  if (event.type === "changes_requested") return "Возвращено";
  return "Пакет готов";
}

function channelLabel(channel: QuoteApprovalEvent["channel"]) {
  if (channel === "email") return "Электронная почта";
  if (channel === "telegram") return "Telegram";
  return "MAX";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone:"Europe/Moscow", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(value));
}
