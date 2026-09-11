"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ProductionTaskPath } from "../data/productionTaskPaths";

export function TaskPathSelector({ tasks }: { tasks: ProductionTaskPath[] }) {
  const [activeId, setActiveId] = useState<string>(tasks[0]?.id ?? "");
  const [expanded, setExpanded] = useState(false);
  const active = tasks.find((task) => task.id === activeId) ?? tasks[0];
  const [first, setFirst] = useState<string>(active.firstOptions[0]);
  const [second, setSecond] = useState<string>(active.secondOptions[0]);
  const featuredTasks = tasks.filter((task) => task.featured);
  const additionalTasks = tasks.filter((task) => !task.featured);

  function selectTask(id: string) {
    const next = tasks.find((task) => task.id === id) ?? tasks[0];
    setActiveId(next.id);
    setFirst(next.firstOptions[0]);
    setSecond(next.secondOptions[0]);
  }

  const emailHref = useMemo(() => {
    const subject = `Подбор: ${active.title}`;
    const body = `Производственная задача: ${active.title}\n${active.firstLabel}: ${first}\n${active.secondLabel}: ${second}\n\nДополнительные условия:`;
    return `mailto:info@7tool.ru?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [active, first, second]);

  return <div className="task-path-selector">
    <div className="task-path-grid" aria-label="Производственные задачи">
      {featuredTasks.map((task) => <button className={`task-path ${task.id === active.id ? "active" : ""}`} type="button" key={task.id} onClick={() => selectTask(task.id)} aria-pressed={task.id === active.id}>
        <span>{task.label}</span><b>{task.title}</b><small>{task.copy}</small>{task.image && <Image src={task.image} alt="" width={260} height={170} />}
      </button>)}
    </div>
    {additionalTasks.length > 0 && <div className="task-path-more"><button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>{expanded ? "Скрыть дополнительные задачи" : `Все производственные задачи · ещё ${additionalTasks.length}`}<span aria-hidden="true">{expanded ? "−" : "+"}</span></button>{expanded && <div className="task-path-more-grid">{additionalTasks.map((task) => <button className={task.id === active.id ? "active" : ""} type="button" key={task.id} onClick={() => selectTask(task.id)} aria-pressed={task.id === active.id}><span>{task.label}</span><b>{task.title}</b><small>{task.copy}</small></button>)}</div>}</div>}
    <div className="task-path-detail">
      <div className="task-path-intro"><span className="eyebrow">Выбрано</span><h3>{active.title}</h3><p>Ответьте на два вопроса. Остальные условия можно добавить инженеру обычным текстом.</p></div>
      <div className="task-path-questions">
        <fieldset><legend><span>01</span>{active.firstLabel}</legend><div>{active.firstOptions.map((option) => <button className={first === option ? "active" : ""} type="button" key={option} aria-pressed={first === option} onClick={() => setFirst(option)}>{option}</button>)}</div></fieldset>
        <fieldset><legend><span>02</span>{active.secondLabel}</legend><div>{active.secondOptions.map((option) => <button className={second === option ? "active" : ""} type="button" key={option} aria-pressed={second === option} onClick={() => setSecond(option)}>{option}</button>)}</div></fieldset>
      </div>
      <div className="task-path-result" aria-live="polite"><div><small>Предварительный маршрут · {first} · {second}</small><b>{active.result}</b><span>{active.resultCopy}</span></div>{active.href ? <Link href={active.href}>{active.action} →</Link> : <a href={emailHref}>{active.action} →</a>}{active.href ? <a className="task-path-email" href={emailHref}>Спросить по email</a> : <a className="task-path-email" href="#quick-order">Добавить описание</a>}</div>
    </div>
  </div>;
}
