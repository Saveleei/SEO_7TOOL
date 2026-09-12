"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Status = "received" | "checking" | "quote_ready" | "sent";
const nextAction: Record<Status, { status: Status; label: string } | null> = {
  received:{ status:"checking", label:"Взять в проверку" },
  checking:{ status:"quote_ready", label:"Отметить «КП готово»" },
  quote_ready:{ status:"sent", label:"Отметить отправленным" },
  sent:null,
};
const previousAction: Partial<Record<Status, { status: Status; label: string }>> = {
  checking:{ status:"received", label:"Вернуть в новые" },
  quote_ready:{ status:"checking", label:"Вернуть на проверку" },
};

export function ManagerRequestActions({ requestId, status, assignee }: { requestId: string; status: Status; assignee: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function act(payload: Record<string, string>, successMessage: string) {
    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/quote-requests/${encodeURIComponent(requestId)}/events`, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ ...payload, idempotencyKey:crypto.randomUUID() }),
      });
      const result = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message || "Действие не сохранено.");
      setMessage(successMessage);
      if (payload.type === "note_added") setNote("");
      router.refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Действие не сохранено.");
    } finally {
      setPending(false);
    }
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await act({ type:"note_added", note }, "Заметка сохранена в истории.");
  }

  const forward = nextAction[status];
  const backward = previousAction[status];
  return <section className="manager-action-panel" aria-labelledby="manager-actions-title">
    <div className="manager-action-heading"><span>Работа с заявкой</span><h2 id="manager-actions-title">Следующее действие</h2><p>Все изменения записываются отдельными событиями. Исходная заявка не перезаписывается.</p></div>
    <a className="quote-builder-open" href={`/test/requests/${requestId}/quote`}><span>Документ для клиента</span><b>Подготовить и согласовать КП</b><i aria-hidden="true">→</i></a>
    {!assignee && <button className="manager-assign-button" type="button" disabled={pending} onClick={() => act({ type:"assigned", assignee:"evgeny-savelev" }, "Ответственный назначен.")}><span>Ответственный</span><b>Назначить Евгения Савельева</b></button>}
    {assignee && <div className="manager-assigned"><span>Ответственный</span><b>Евгений Савельев</b></div>}
    <div className="manager-status-actions">
      {forward ? <button type="button" disabled={pending} onClick={() => act({ type:"status_changed", status:forward.status }, `Этап изменён: ${forward.label}.`)}>{pending ? "Сохраняем…" : forward.label}</button> : <div className="manager-workflow-complete"><b>Заявка завершена</b><span>Этап «Отправлено» зафиксирован в истории.</span></div>}
      {backward && <button className="secondary" type="button" disabled={pending} onClick={() => act({ type:"status_changed", status:backward.status }, backward.label)}>{backward.label}</button>}
    </div>
    <form className="manager-note-form" onSubmit={submitNote}>
      <label htmlFor="manager-note"><span>Внутренняя заметка</span><small>Видна только в локальном рабочем месте, клиенту не отправляется</small></label>
      <textarea id="manager-note" name="note" rows={4} maxLength={1500} required minLength={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Например: запросить срок у поставщика и проверить комплект корончатых сверл." />
      <div><span>{note.length}/1500</span><button type="submit" disabled={pending || note.trim().length < 3}>{pending ? "Сохраняем…" : "Добавить заметку"}</button></div>
    </form>
    <div className="manager-action-feedback" aria-live="polite">{error ? <p className="error">{error}</p> : message ? <p className="success">{message}</p> : null}</div>
  </section>;
}
