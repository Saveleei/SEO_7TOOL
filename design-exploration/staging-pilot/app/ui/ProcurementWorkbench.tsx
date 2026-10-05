"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { buildRequestSource } from "../data/requestAttribution";

type Tool = "task" | "analog" | "spec";
type Direction = { key: string; title: string; summary: string; href: string };

const taskDirections: Array<Direction & { pattern: RegExp }> = [
  { key:"drilling", title:"Сверление и резьба", summary:"Сверлильные станки, корончатые свёрла, метчики и совместимая оснастка.", href:"/catalog/task/drilling", pattern:/сверл|отверст|резьб|метчик|зенков/iu },
  { key:"edge", title:"Обработка кромки", summary:"Кромкорезы для листа и труб с подбором по геометрии фаски и размеру заготовки.", href:"/catalog/task/edge", pattern:/кром|фаск|торец|торц/iu },
  { key:"cutting", title:"Резка металла", summary:"Труборезы, пилы, диски и оборудование термической резки по типу заготовки.", href:"/catalog/task/cutting", pattern:/резк|отрез|раскро|пил/iu },
  { key:"welding", title:"Сварка и автоматизация", summary:"Сварочные каретки, вращатели, позиционеры и роботизированные решения.", href:"/catalog/task/welding", pattern:/свар|шов|наплав/iu },
  { key:"tooling", title:"Оснастка и расходные материалы", summary:"Борфрезы, сверлильная и станочная оснастка с проверкой совместимости.", href:"/catalog/task/tooling", pattern:/борфрез|оснаст|расход|инструмент/iu },
  { key:"workplace", title:"Оснащение производства", summary:"Компрессоры, грузозахватное и вспомогательное оборудование для участка.", href:"/catalog/task/workplace", pattern:/компресс|воздух|груз|захват|участ/iu },
];

const fallbackDirection: Direction = { key:"catalog", title:"Инженерный подбор по задаче", summary:"Описание сохранит контекст. Инженер уточнит материал, размеры и режим работы, затем предложит подходящие разделы.", href:"/catalog" };

export function ProcurementWorkbench({ initialTask, initialTool }: { initialTask?: string; initialTool?: Tool }) {
  const initialValue = initialTask?.trim().slice(0, 500) || "";
  const [tool, setTool] = useState<Tool>(initialTool ?? "task");
  const [task, setTask] = useState(initialValue);
  const [analog, setAnalog] = useState("");
  const [specFile, setSpecFile] = useState<File | null>(null);
  const [specFileError, setSpecFileError] = useState("");
  const [checked, setChecked] = useState(Boolean(initialValue));
  const [contactOpen, setContactOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestNumber, setRequestNumber] = useState("");
  const [formError, setFormError] = useState("");
  const idempotencyKeyRef = useRef("");
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const direction = useMemo(() => resolveTaskDirection(task), [task]);

  useEffect(() => {
    if (contactOpen && !requestNumber) phoneInputRef.current?.focus();
  }, [contactOpen, requestNumber]);

  function resetJourney() {
    setChecked(false);
    setContactOpen(false);
    setRequestNumber("");
    setFormError("");
    idempotencyKeyRef.current = "";
  }

  function chooseTool(next: Tool) {
    setTool(next);
    resetJourney();
  }

  function openContact() {
    setContactOpen(true);
    setFormError("");
    trackWorkbench("open_selection_contact", tool);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const context = requestContext(tool, task, analog, direction);
    const formData = new FormData(event.currentTarget);
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID();
    formData.set("request_type", "selection");
    formData.set("email", "");
    formData.set("city", "");
    formData.set("comment", context.comment);
    formData.set("idempotency_key", idempotencyKeyRef.current);
    formData.set("alternatives", "on");
    formData.set("check_availability", "on");
    formData.set("check_set", "on");
    formData.set("check_docs", "on");
    formData.set("items", JSON.stringify([{ id:context.id, title:context.title, article:context.article, quantity:1, href:context.href }]));
    formData.set("source", JSON.stringify(buildRequestSource()));
    if (tool === "spec" && specFile) formData.set("specification_file", specFile, specFile.name);
    setSubmitting(true);
    setFormError("");
    trackWorkbench("submit_selection_request", tool);
    try {
      const response = await fetch("/api/quote-requests", { method:"POST", body:formData, headers:{ "X-Requested-With":"7tool-selection-request" } });
      const result = await response.json() as { ok?: boolean; requestNumber?: string; message?: string };
      if (!response.ok || !result.ok || !result.requestNumber) throw new Error(result.message || "Не удалось сохранить задачу.");
      setRequestNumber(result.requestNumber);
      trackWorkbench("selection_request_success", tool);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Не удалось сохранить задачу. Попробуйте ещё раз.");
      trackWorkbench("selection_request_error", tool);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="procurement-workbench" id="quick-order">
      <div className="workbench-tabs" role="tablist" aria-label="Способ передать задачу">
        <button id="workbench-task-tab" role="tab" aria-selected={tool === "task"} aria-controls="workbench-task-panel" type="button" className={tool === "task" ? "active" : ""} onClick={() => chooseTool("task")}>Описать задачу</button>
        <button id="workbench-analog-tab" role="tab" aria-selected={tool === "analog"} aria-controls="workbench-analog-panel" type="button" className={tool === "analog" ? "active" : ""} onClick={() => chooseTool("analog")}>Подобрать аналог</button>
        <button id="workbench-spec-tab" role="tab" aria-selected={tool === "spec"} aria-controls="workbench-spec-panel" type="button" className={tool === "spec" ? "active" : ""} onClick={() => chooseTool("spec")}>Передать ТЗ</button>
      </div>

      {tool === "task" && <div className="workbench-panel" id="workbench-task-panel" role="tabpanel" aria-labelledby="workbench-task-tab">
        <span className="workbench-kicker">Шаг 1 · артикул знать не нужно</span>
        <h3>Что нужно сделать на производстве?</h3>
        <p className="workbench-intro">Укажите операцию, материал, размер и условия работы — достаточно того, что уже известно.</p>
        <textarea value={task} onChange={(event) => { setTask(event.target.value.slice(0, 500)); resetJourney(); }} rows={5} maxLength={500} placeholder="Например: сверлить отверстия Ø35 мм в металлоконструкции на монтаже" aria-label="Описание производственной задачи" />
        <button className="workbench-primary" type="button" disabled={task.trim().length < 5} onClick={() => { setChecked(true); setContactOpen(false); trackWorkbench("show_task_direction", tool); }}>Показать подходящее направление</button>
        {checked && <WorkBenchResult direction={direction} onContact={openContact} />}
      </div>}

      {tool === "analog" && <div className="workbench-panel" id="workbench-analog-panel" role="tabpanel" aria-labelledby="workbench-analog-tab">
        <span className="workbench-kicker">Шаг 1 · исходная модель</span>
        <h3>Какую модель нужно заменить?</h3>
        <p className="workbench-intro">Напишите производителя и модель. Инженер сравнит не название, а рабочие параметры и комплектацию.</p>
        <input value={analog} onChange={(event) => { setAnalog(event.target.value.slice(0, 180)); resetJourney(); }} maxLength={180} placeholder="Например: FE Powertools ECO.50S+" aria-label="Модель для подбора аналога" />
        <button className="workbench-primary" type="button" disabled={analog.trim().length < 3} onClick={() => { setChecked(true); setContactOpen(false); trackWorkbench("show_analog_path", tool); }}>Проверить модель и варианты</button>
        {checked && <div className="workbench-result">
          <span>Заявка ещё не отправлена</span>
          <h4>Сначала найдём модель, затем сравним параметры</h4>
          <p>Проверим диаметр и глубину, посадку инструмента, функции, комплектацию и условия эксплуатации.</p>
          <div className="workbench-result-actions"><a href={`/search?q=${encodeURIComponent(analog.trim())}`}>Проверить в каталоге</a><button type="button" onClick={openContact}>Передать инженеру</button></div>
          <small>Чтобы менеджер увидел запрос и мог ответить, на следующем шаге нужен телефон.</small>
        </div>}
      </div>}

      {tool === "spec" && <div className="workbench-panel" id="workbench-spec-panel" role="tabpanel" aria-labelledby="workbench-spec-tab">
        <span className="workbench-kicker">Шаг 1 · ТЗ и спецификации</span>
        <h3>Приложите файл прямо к заявке</h3>
        <p className="workbench-intro">Файл сохранится вместе с задачей и номером заявки. Переходить в почту и повторно объяснять запрос не потребуется.</p>
        <label className={`workbench-spec-upload${specFile ? " is-selected" : ""}`}>
          <span><b>{specFile ? specFile.name : "Выберите техническое задание"}</b><small>{specFile ? formatFileSize(specFile.size) : "PDF, DOCX, XLSX, JPG или PNG · до 10 МБ"}</small></span>
          <input type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg" onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setSpecFile(file && file.size <= 10 * 1024 * 1024 ? file : null);
            setSpecFileError(file && file.size > 10 * 1024 * 1024 ? "Файл больше 10 МБ. Выберите файл меньшего размера." : "");
            resetJourney();
            if (file && file.size <= 10 * 1024 * 1024) trackWorkbench("select_specification_file", tool);
          }} />
        </label>
        {specFileError && <div className="workbench-contact-error" role="alert">{specFileError}</div>}
        <button className="workbench-primary" type="button" disabled={!specFile} onClick={openContact}>Продолжить и указать телефон</button>
        <small className="workbench-note">Файл не публикуется в каталоге. Скачать его сможет только сотрудник с доступом к заявкам.</small>
      </div>}

      {contactOpen && !requestNumber && <form className="workbench-contact-form" onSubmit={submit}>
        <input className="request-cart-honeypot" name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" />
        <header><span>Шаг 2 · передать менеджеру</span><h4>Куда перезвонить по задаче?</h4><p>После отправки запрос получит номер и появится в журнале 7TOOL. Описание выше повторно вводить не нужно.</p></header>
        <label>Телефон для связи <span>*</span><input ref={phoneInputRef} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 999 000-00-00" required /></label>
        <label>Имя или компания<input name="company" type="text" autoComplete="organization" maxLength={160} placeholder="Необязательно" /></label>
        <label className="workbench-contact-consent"><input name="consent" type="checkbox" defaultChecked required /> <span>Я согласен с <a href="/soglasie-na-obrabotku" target="_blank">обработкой персональных данных</a></span></label>
        {formError && <div className="workbench-contact-error" role="alert">{formError}</div>}
        <div className="workbench-contact-submit"><button type="submit" disabled={submitting}>{submitting ? "Сохраняем задачу…" : "Отправить задачу менеджеру"}</button><small>Задача надёжно сохранится с номером заявки и будет доступна менеджеру вместе с выбранными параметрами.</small></div>
      </form>}

      {requestNumber && <div className="workbench-success" role="status">
        <span>Задача сохранена</span><h4>Заявка № {requestNumber}</h4><p>Она уже доступна менеджеру вместе с описанием задачи, контактным телефоном{tool === "spec" ? " и приложенным ТЗ" : ""}.</p><strong>Сохраните номер заявки — менеджер использует его при уточнении задачи.</strong><div><a href="/contacts">Как связаться по заявке</a><button type="button" onClick={resetJourney}>Создать ещё одну</button></div>
      </div>}
    </div>
  );
}

function WorkBenchResult({ direction, onContact }: { direction: Direction; onContact: () => void }) {
  return <div className="workbench-result">
    <span>Предварительное направление · заявка ещё не отправлена</span>
    <h4>{direction.title}</h4>
    <p>{direction.summary}</p>
    <div className="workbench-result-actions"><a href={direction.href}>Посмотреть подходящие разделы</a><button type="button" onClick={onContact}>Передать задачу инженеру</button></div>
    <small>Точный подбор начнётся после того, как вы оставите телефон на следующем шаге.</small>
  </div>;
}

function resolveTaskDirection(task: string): Direction {
  return taskDirections.find((candidate) => candidate.pattern.test(task)) ?? fallbackDirection;
}

function requestContext(tool: Tool, task: string, analog: string, direction: Direction) {
  if (tool === "analog") return { id:"selection:analog", title:`Подбор аналога: ${analog.trim() || "модель не указана"}`, article:"Исходная модель клиента", href:`/search?q=${encodeURIComponent(analog.trim())}`, comment:`Подбор аналога. Исходная модель: ${analog.trim() || "не указана"}. Требуется сверить рабочие параметры, комплектацию, наличие и срок.` };
  if (tool === "spec") return { id:"selection:specification", title:"Разбор технического задания или спецификации", article:"Файл приложен к заявке", href:"/catalog", comment:"Клиент приложил техническое задание или спецификацию и просит связаться по телефону для подбора и подтверждения поставки." };
  return { id:`selection:task:${direction.key}`, title:`Подбор по задаче: ${direction.title}`, article:"Без артикула — инженерный подбор", href:direction.href, comment:`Производственная задача: ${task.trim()}. Предварительное направление: ${direction.title}. Требуется уточнить параметры, наличие, совместимость, документы и срок.` };
}

function trackWorkbench(event: string, tool: Tool) {
  window.dispatchEvent(new CustomEvent("7tool:prototype-event", { detail:{ event, page_type:"homepage", placement:"procurement_workbench", request_type:tool } }));
}

function formatFileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} КБ · файл готов к отправке` : `${(bytes / 1024 / 1024).toFixed(1)} МБ · файл готов к отправке`;
}
