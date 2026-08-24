"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  CompatibilityRow,
  PublicInteractiveTool,
  RpmToolRule,
  SelectorCriterion,
  SelectorProduct,
} from "@/lib/tool-platform-db";

function normalize(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/\s+/gu, " ");
}

function includesValue(candidate: number | string[], requested: string) {
  const values = Array.isArray(candidate) ? candidate : [candidate];
  return values.some((value) => normalize(value) === normalize(requested));
}

function matches(product: SelectorProduct, criterion: SelectorCriterion, requested: string) {
  if (!requested) return true;
  if (criterion.operator === "RANGE_CONTAINS") {
    const minimum = product.facts.angleMin?.value;
    const maximum = product.facts.angleMax?.value;
    const value = Number(requested);
    return Number.isFinite(value) && typeof minimum === "number" && typeof maximum === "number" && minimum <= value && maximum >= value;
  }
  const fact = product.facts[criterion.capability];
  if (!fact) return false;
  if (criterion.operator === "INCLUDES") return includesValue(fact.value, requested);
  const value = Number(requested);
  if (!Number.isFinite(value) || typeof fact.value !== "number") return false;
  return criterion.operator === "NUMBER_GTE" ? fact.value >= value : fact.value <= value;
}

export function InteractiveToolWorkbench({ tool }: { tool: PublicInteractiveTool }) {
  if (tool.type === "ANNULAR_CUTTER_RPM") return <RpmCalculator rules={tool.rules} />;
  if (tool.type === "COMPATIBILITY_TABLE") return <CompatibilityTable rows={tool.rows} />;
  return <ProductSelector criteria={tool.criteria} products={tool.products} />;
}

function RpmCalculator({ rules }: { rules: RpmToolRule[] }) {
  const cutterTypes = [...new Set(rules.map((rule) => rule.cutterType))];
  const [cutterType, setCutterType] = useState(cutterTypes[0] ?? "");
  const materials = [...new Set(rules.filter((rule) => rule.cutterType === cutterType).map((rule) => rule.material))];
  const [material, setMaterial] = useState(materials[0] ?? "");
  const [diameter, setDiameter] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const rule = rules.find((item) => item.cutterType === cutterType && item.material === material);
  const numericDiameter = Number(diameter);
  const result = submitted && rule && Number.isFinite(numericDiameter) && numericDiameter > 0 && numericDiameter <= 1000
    ? Math.round((1000 * rule.cuttingSpeed) / (Math.PI * numericDiameter))
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.75fr)]">
      <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }} className="grid gap-5 rounded-[14px] border border-steel-200 bg-white p-5 shadow-card sm:grid-cols-2 sm:p-7">
        <label className="text-[12px] font-bold text-steel-700">
          Тип коронки
          <select value={cutterType} onChange={(event) => {
            const nextType = event.target.value;
            setCutterType(nextType);
            setMaterial(rules.find((item) => item.cutterType === nextType)?.material ?? "");
            setSubmitted(false);
          }} className="mt-1.5 min-h-11 w-full rounded-md border border-steel-200 bg-white px-3 text-[14px] font-normal text-steel-900 focus:border-amber-400 focus:outline-none">
            {cutterTypes.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-[12px] font-bold text-steel-700">
          Материал
          <select value={material} onChange={(event) => { setMaterial(event.target.value); setSubmitted(false); }} className="mt-1.5 min-h-11 w-full rounded-md border border-steel-200 bg-white px-3 text-[14px] font-normal text-steel-900 focus:border-amber-400 focus:outline-none">
            {materials.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-[12px] font-bold text-steel-700 sm:col-span-2">
          Диаметр коронки, мм
          <input type="number" min="0.1" max="1000" step="0.1" required value={diameter} onChange={(event) => { setDiameter(event.target.value); setSubmitted(false); }} placeholder="Например, 35" className="mt-1.5 min-h-11 w-full rounded-md border border-steel-200 px-3 text-[14px] font-normal text-steel-900 focus:border-amber-400 focus:outline-none" />
        </label>
        <button className="min-h-11 rounded-md bg-amber-400 px-5 text-[14px] font-extrabold text-steel-900 shadow-amber transition hover:bg-amber-300 sm:col-span-2">Рассчитать обороты</button>
      </form>
      <section aria-live="polite" className="rounded-[14px] border border-cobalt-200 bg-cobalt-50/55 p-6 sm:p-7">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cobalt-700">Результат по проверенному коэффициенту</div>
        {result !== null && rule ? (
          <>
            <div className="mt-4 font-display text-[44px] font-black leading-none text-steel-900">{result} <span className="text-[20px]">об/мин</span></div>
            <p className="mt-4 text-[13px] leading-6 text-steel-700">В расчёте использована проверенная скорость резания {rule.cuttingSpeed} {rule.unit}. Формула: 1000 × скорость / (π × диаметр).</p>
          </>
        ) : (
          <p className="mt-4 text-[14px] leading-7 text-steel-700">Выберите пару «тип коронки — материал» и укажите диаметр. Результат появится только при наличии проверенного правила.</p>
        )}
        <p className="mt-5 border-t border-cobalt-200 pt-4 text-[11px] leading-5 text-steel-600">Расчёт является исходной рекомендацией. Режим конкретного инструмента сверяйте с паспортом коронки, станка, охлаждением и условиями обработки.</p>
      </section>
    </div>
  );
}

function criterionOptions(products: SelectorProduct[], criterion: SelectorCriterion) {
  if (criterion.operator !== "INCLUDES") return [];
  return [...new Set(products.flatMap((product) => {
    const value = product.facts[criterion.capability]?.value;
    return Array.isArray(value) ? value : [];
  }))].sort((left, right) => left.localeCompare(right, "ru"));
}

function ProductSelector({ criteria, products }: { criteria: SelectorCriterion[]; products: SelectorProduct[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const active = criteria.some((criterion) => answers[criterion.name]?.trim());
  const matchesList = useMemo(() => active ? products.filter((product) => criteria.every((criterion) => matches(product, criterion, answers[criterion.name] ?? ""))) : [], [active, answers, criteria, products]);

  return (
    <div className="grid gap-7 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
      <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }} className="grid gap-4 rounded-[14px] border border-steel-200 bg-white p-5 shadow-card sm:grid-cols-2 lg:sticky lg:top-28 lg:grid-cols-1">
        {criteria.map((criterion) => {
          const options = criterionOptions(products, criterion);
          return (
            <label key={criterion.name} className="text-[12px] font-bold text-steel-700">
              {criterion.label}{criterion.unit ? `, ${criterion.unit}` : ""}
              {options.length ? (
                <select value={answers[criterion.name] ?? ""} onChange={(event) => { setAnswers((current) => ({ ...current, [criterion.name]: event.target.value })); setSubmitted(false); }} className="mt-1.5 min-h-11 w-full rounded-md border border-steel-200 bg-white px-3 text-[14px] font-normal text-steel-900 focus:border-amber-400 focus:outline-none">
                  <option value="">Не учитывать</option>
                  {options.map((value) => <option key={value}>{value}</option>)}
                </select>
              ) : (
                <input type="number" min="0" step="0.1" value={answers[criterion.name] ?? ""} onChange={(event) => { setAnswers((current) => ({ ...current, [criterion.name]: event.target.value })); setSubmitted(false); }} placeholder="Не учитывать" className="mt-1.5 min-h-11 w-full rounded-md border border-steel-200 px-3 text-[14px] font-normal text-steel-900 focus:border-amber-400 focus:outline-none" />
              )}
            </label>
          );
        })}
        <button disabled={!active} className="min-h-11 rounded-md bg-amber-400 px-5 text-[14px] font-extrabold text-steel-900 shadow-amber transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50">Показать подходящие модели</button>
        <p className="text-[11px] leading-5 text-steel-500">Можно указать только известные параметры. Модель без подтверждения одного из выбранных условий не попадёт в результат.</p>
      </form>
      <section aria-live="polite">
        {!submitted ? (
          <EmptyResult title="Задайте параметры" text="После проверки условий здесь появятся только модели с достаточным набором подтверждённых характеристик." />
        ) : matchesList.length ? (
          <>
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-[24px] font-extrabold text-steel-900">Подтверждённые совпадения</h2>
              <span className="text-[12px] font-bold text-steel-500">{matchesList.length}</span>
            </div>
            <div className="mt-4 grid gap-4">
              {matchesList.map((product) => (
                <article key={product.id} className="rounded-[14px] border border-steel-200 bg-white p-5 shadow-soft">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">{product.brand || "Оборудование"}</div>
                  <h3 className="mt-2 font-display text-[19px] font-extrabold text-steel-900"><Link href={`/p/${product.slug}`} className="hover:text-amber-700">{product.title}</Link></h3>
                  <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                    {criteria.flatMap((criterion) => {
                      if (criterion.operator === "RANGE_CONTAINS") {
                        const min = product.facts.angleMin;
                        const max = product.facts.angleMax;
                        return min && max ? [{ label: criterion.label, display: `${min.display}–${max.display}` }] : [];
                      }
                      const fact = product.facts[criterion.capability];
                      return fact ? [{ label: criterion.label, display: fact.display }] : [];
                    }).map((fact) => (
                      <div key={`${fact.label}-${fact.display}`} className="rounded-md bg-steel-50 px-3 py-2">
                        <dt className="text-[10px] font-bold uppercase tracking-wider text-steel-500">{fact.label}</dt>
                        <dd className="mt-1 text-[12px] font-semibold text-steel-800">{fact.display}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              ))}
            </div>
          </>
        ) : <EmptyResult title="Подтверждённых совпадений нет" text="Это не означает, что подходящего товара не существует: для части моделей может не хватать проверенных характеристик. Передайте задачу инженеру для ручной проверки." />}
      </section>
    </div>
  );
}

function EmptyResult({ title, text }: { title: string; text: string }) {
  return <div className="rounded-[14px] border border-steel-200 bg-steel-50/70 px-6 py-10"><h2 className="font-display text-[23px] font-extrabold text-steel-900">{title}</h2><p className="mt-3 max-w-[620px] text-[14px] leading-7 text-steel-600">{text}</p></div>;
}

function CompatibilityTable({ rows }: { rows: CompatibilityRow[] }) {
  if (!rows.length) return <EmptyResult title="Таблица проходит проверку" text="Публичные связи появятся после подтверждения совместимости конкретных товаров и оснастки." />;
  return (
    <div className="overflow-x-auto rounded-[14px] border border-steel-200 bg-white shadow-card">
      <table className="w-full min-w-[980px] border-collapse text-left text-[12px]">
        <caption className="border-b border-steel-200 bg-steel-50 px-5 py-4 text-left text-[12px] leading-5 text-steel-600">Каждая строка связана с действующим проверенным утверждением о совместимости. Прочерк означает отсутствие проверенного значения.</caption>
        <thead><tr className="border-b border-steel-200 bg-white text-[10px] uppercase tracking-wider text-steel-500">
          <th className="px-4 py-3">Product</th><th className="px-4 py-3">Compatible accessories</th><th className="px-4 py-3">Shank</th><th className="px-4 py-3">Max diameter</th><th className="px-4 py-3">Depth</th><th className="px-4 py-3">Application</th>
        </tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id} className="border-b border-steel-100 last:border-0">
          <td className="px-4 py-4 align-top font-bold text-steel-900"><Link href={`/p/${row.product.slug}`} className="hover:text-amber-700">{row.product.title}</Link></td>
          <td className="px-4 py-4 align-top"><Link href={`/p/${row.accessory.slug}`} className="font-semibold text-cobalt-700 hover:text-cobalt-900">{row.accessory.title}</Link><span className="mt-1 block text-[10px] text-steel-500">{row.compatibilityType}</span></td>
          <td className="px-4 py-4 align-top text-steel-700">{row.shank ?? "—"}</td><td className="px-4 py-4 align-top text-steel-700">{row.maxDiameter ?? "—"}</td><td className="px-4 py-4 align-top text-steel-700">{row.depth ?? "—"}</td><td className="px-4 py-4 align-top text-steel-700">{row.application ?? "—"}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}
