"use client";

import { useState } from "react";

type Tool = "task" | "analog" | "spec";

export function ProcurementWorkbench() {
  const [tool, setTool] = useState<Tool>("task");
  const [task, setTask] = useState("Нужно сверлить отверстия Ø35 мм в металлоконструкции на монтаже");
  const [analog, setAnalog] = useState("FE Powertools ECO.50S+");
  const [checked, setChecked] = useState(false);

  return (
    <div className="procurement-workbench" id="quick-order">
      <div className="workbench-tabs" role="tablist" aria-label="Инструменты снабжения">
        <button type="button" className={tool === "task" ? "active" : ""} onClick={() => { setTool("task"); setChecked(false); }}>Описать задачу</button>
        <button type="button" className={tool === "analog" ? "active" : ""} onClick={() => { setTool("analog"); setChecked(false); }}>Подобрать аналог</button>
        <button type="button" className={tool === "spec" ? "active" : ""} onClick={() => { setTool("spec"); setChecked(false); }}>Отправить файл</button>
      </div>

      {tool === "task" && <div className="workbench-panel">
        <span className="workbench-kicker">Инженерный подбор без знания артикула</span>
        <h3>Опишите, что нужно сделать</h3>
        <textarea value={task} onChange={(event) => { setTask(event.target.value); setChecked(false); }} rows={5} aria-label="Описание производственной задачи" />
        <button className="workbench-primary" type="button" onClick={() => setChecked(true)}>Подобрать класс оборудования</button>
        {checked && <div className="task-result" role="status"><b>Запрос понятен для предварительного подбора</b><span>Операция: сверление · диаметр: 35 мм · условия: монтаж</span><small>Инженер уточнит материал, глубину и доступную высоту, затем подтвердит модель, цену и срок.</small></div>}
      </div>}

      {tool === "analog" && <div className="workbench-panel">
        <span className="workbench-kicker">Монетизация отсутствующего и конкурентного спроса</span>
        <h3>Введите модель, которую нужно заменить</h3>
        <input value={analog} onChange={(event) => { setAnalog(event.target.value); setChecked(false); }} aria-label="Модель для подбора аналога" />
        <button className="workbench-primary" type="button" onClick={() => setChecked(true)}>Найти аналоги</button>
        {checked && <div className="analog-result" role="status"><p>Для «{analog || "указанной модели"}» сначала сверим рабочие параметры.</p><div><span>Диаметр и глубина</span><span>Шпиндель и функции</span><span>Условия эксплуатации</span></div><a href="mailto:info@7tool.ru?subject=Подбор%20аналога">Передать запрос инженеру →</a></div>}
      </div>}

      {tool === "spec" && <div className="workbench-panel">
        <span className="workbench-kicker">Для отдела снабжения и проектных закупок</span>
        <h3>Передайте файл удобным способом</h3>
        <div className="dropzone"><b>XLSX · PDF · DOCX</b><span>Загрузка будет подключена после утверждения прототипа</span></div>
        <a className="workbench-primary" href="mailto:info@7tool.ru?subject=Спецификация%20на%20подбор">Отправить на info@7tool.ru</a>
        <small className="workbench-note">В ответе: разбор задачи, подходящие варианты, цена с НДС и подтверждённый срок.</small>
      </div>}
    </div>
  );
}
