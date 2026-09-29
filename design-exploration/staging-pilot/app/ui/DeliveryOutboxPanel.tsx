"use client";

import { useState } from "react";
import type { QuoteDeliveryWorkspace } from "../data/quoteDeliveryStore";

const confirmationOptions = [
  ["recipient", "Получатель и канал связи сверены с заявкой"],
  ["document", "Открыта именно эта редакция PDF и проверено её содержание"],
  ["authority", "Получено внутреннее разрешение передать документ клиенту"],
] as const;

export function DeliveryOutboxPanel({ initial }: { initial: QuoteDeliveryWorkspace }) {
  const [workspace, setWorkspace] = useState(initial);
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const allConfirmed = confirmationOptions.every(([key]) => confirmations[key]);
  const deliveryPackage = workspace.package;

  async function enqueue() {
    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/quote-requests/${encodeURIComponent(deliveryPackage.requestId)}/delivery`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ revision:deliveryPackage.revision, idempotencyKey:crypto.randomUUID(), confirmations }),
      });
      const result = await response.json() as { ok?: boolean; message?: string; workspace?: QuoteDeliveryWorkspace; duplicate?: boolean };
      if (!response.ok || !result.ok || !result.workspace) throw new Error(result.message || "Пакет не зафиксирован.");
      setWorkspace(result.workspace);
      setMessage(result.duplicate ? "Этот пакет уже был зафиксирован — новая копия не создана." : "Пакет зафиксирован во внутренней очереди.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Пакет не зафиксирован.");
    } finally {
      setPending(false);
    }
  }

  return <section className="quote-outbox-panel" id="quote-delivery-outbox" aria-labelledby="quote-outbox-title">
    <header><div><p className="eyebrow">Контроль перед передачей</p><h2 id="quote-outbox-title">Пакет для клиента</h2><p>Точные данные собраны сервером из утверждённой редакции. Получатель, текст и PDF здесь не редактируются.</p></div><span className={workspace.outbox ? "is-held" : "is-review"}>{workspace.outbox ? "Во внутренней очереди" : "Нужна проверка"}</span></header>
    <div className="quote-outbox-grid">
      <div className="quote-outbox-package">
        <dl>
          <div><dt>Канал и получатель</dt><dd><b>{channelLabel(deliveryPackage.channel)}</b><span>{deliveryPackage.recipient}</span></dd></div>
          <div><dt>Тема</dt><dd>{deliveryPackage.subject}</dd></div>
          <div><dt>Документ</dt><dd><b>{deliveryPackage.pdfFileName}</b><span>Редакция №{deliveryPackage.revision}</span></dd></div>
        </dl>
        <div className="quote-outbox-message"><span>Текст сопровождения</span><p>{deliveryPackage.message}</p></div>
        <div className="quote-outbox-document-actions"><a href={deliveryPackage.previewUrl}>Проверить документ</a><a className="secondary" href={deliveryPackage.pdfUrl}>Скачать PDF</a></div>
        <p className="quote-outbox-fingerprint">Контрольная сумма пакета: <code>{deliveryPackage.packageFingerprint}</code></p>
      </div>
      {workspace.outbox ? <OutboxStatus workspace={workspace} /> : <fieldset className="quote-outbox-confirmations"><legend>Перед постановкой в очередь</legend><p>Три ручные проверки защищают от отправки неверному адресату или не той редакции.</p>{confirmationOptions.map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(confirmations[key])} onChange={(event) => setConfirmations((current) => ({ ...current, [key]:event.target.checked }))} /><span>{label}</span></label>)}<button type="button" disabled={pending || !allConfirmed} onClick={enqueue}>{pending ? "Фиксируем…" : "Зафиксировать во внутренней очереди"}</button><small>Это не отправка. Пакет останется во внутренней очереди до подтверждённой передачи сотрудником.</small></fieldset>}
    </div>
    <div className="quote-outbox-feedback" aria-live="polite">{error ? <p className="error">{error}</p> : message ? <p className="success">{message}</p> : null}</div>
  </section>;
}

function OutboxStatus({ workspace }: { workspace: QuoteDeliveryWorkspace }) {
  const record = workspace.outbox!;
  return <aside className="quote-outbox-status"><span>Статус</span><h3>Удерживается внутри системы</h3><p>Клиенту ничего не отправлено. Пакет ждёт подключения и отдельной проверки транспортного канала.</p><dl><div><dt>Номер записи</dt><dd>{record.id}</dd></div><div><dt>Зафиксировал</dt><dd>{record.queuedBy.name}<small>{record.queuedBy.roleLabel}</small></dd></div><div><dt>Время</dt><dd>{formatDate(record.queuedAt)}</dd></div><div><dt>Попыток отправки</dt><dd>{record.attempts}</dd></div></dl><b>Автоматическая отправка отключена</b></aside>;
}

function channelLabel(channel: QuoteDeliveryWorkspace["package"]["channel"]) {
  if (channel === "email") return "Электронная почта";
  if (channel === "telegram") return "Telegram";
  return "MAX";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone:"Europe/Moscow", day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }).format(new Date(value));
}
