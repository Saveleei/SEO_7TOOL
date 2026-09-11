"use client";

import Link from "next/link";
import { useState } from "react";

type Tool = "bulk" | "analog" | "spec";

export function ProcurementWorkbench() {
  const [tool, setTool] = useState<Tool>("bulk");
  const [bulk, setBulk] = useState("STEYR-35 — 2 шт.\nLZHM-025 — 10 шт.");
  const [analog, setAnalog] = useState("FE Powertools ECO.50S+");
  const [checked, setChecked] = useState(false);

  return (
    <div className="procurement-workbench" id="quick-order">
      <div className="workbench-tabs" role="tablist" aria-label="Инструменты снабжения">
        <button type="button" className={tool === "bulk" ? "active" : ""} onClick={() => { setTool("bulk"); setChecked(false); }}>Заказ списком</button>
        <button type="button" className={tool === "analog" ? "active" : ""} onClick={() => { setTool("analog"); setChecked(false); }}>Подобрать аналог</button>
        <button type="button" className={tool === "spec" ? "active" : ""} onClick={() => { setTool("spec"); setChecked(false); }}>Спецификация</button>
      </div>

      {tool === "bulk" && <div className="workbench-panel">
        <span className="workbench-kicker">Артикул + количество</span>
        <h3>Вставьте позиции из заявки</h3>
        <textarea value={bulk} onChange={(event) => { setBulk(event.target.value); setChecked(false); }} rows={5} aria-label="Список артикулов и количества" />
        <button className="workbench-primary" type="button" onClick={() => setChecked(true)}>Распознать позиции</button>
        {checked && <div className="bulk-result" role="status"><div><b>STEYR-35</b><span>Магнитный станок · 2 шт.</span><em>Найден</em></div><div><b>LZHM-025</b><span>Корончатое сверло Ø25 · 10 шт.</span><em>Найден</em></div><small>В рабочей версии позиции попадут в черновик заказа с ценой, наличием и сроком.</small></div>}
      </div>}

      {tool === "analog" && <div className="workbench-panel">
        <span className="workbench-kicker">Монетизация отсутствующего и конкурентного спроса</span>
        <h3>Введите модель, которую нужно заменить</h3>
        <input value={analog} onChange={(event) => { setAnalog(event.target.value); setChecked(false); }} aria-label="Модель для подбора аналога" />
        <button className="workbench-primary" type="button" onClick={() => setChecked(true)}>Найти аналоги</button>
        {checked && <div className="analog-result" role="status"><p>Для «{analog || "указанной модели"}» сравним:</p><div><span>LENZ STEYR-55 T</span><span>HEDEN DM-50V2</span><span>EUROBOOR ECO.50</span></div><Link href="/compare">Открыть сравнительную таблицу →</Link></div>}
      </div>}

      {tool === "spec" && <div className="workbench-panel">
        <span className="workbench-kicker">Для отдела снабжения и проектных закупок</span>
        <h3>Передайте файл удобным способом</h3>
        <div className="dropzone"><b>XLSX · PDF · DOCX</b><span>Загрузка будет подключена после утверждения прототипа</span></div>
        <a className="workbench-primary" href="mailto:info@7tool.ru?subject=Спецификация%20на%20подбор">Отправить на info@7tool.ru</a>
        <small className="workbench-note">В ответе: сопоставление позиций, аналоги, цена с НДС и срок поставки.</small>
      </div>}
    </div>
  );
}
