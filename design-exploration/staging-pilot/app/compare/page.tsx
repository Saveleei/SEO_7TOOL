import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "../ui/Breadcrumbs";
import { PilotFooter } from "../ui/PilotFooter";
import { PilotHeader } from "../ui/PilotHeader";

const models = [
  { name: "LENZ STEYR-35", image: "/products/lenz-steyr-35.jpg", price: "47 999 ₽", availability: "Уточняем", diameter: "35 мм", spiral: "13 мм", power: "1 100 Вт", spindle: "Weldon 19", speeds: "1", reverse: "Нет", weight: "10,5 кг", best: "Лёгкий для монтажа", href: "/product/lenz-steyr-35" },
  { name: "HEDEN DM-36K", image: "/products/heden-dm-36k.png", price: "44 690 ₽", availability: "Уточняем", diameter: "36 мм", spiral: "13 мм", power: "1 600 Вт", spindle: "Weldon 19", speeds: "1", reverse: "Нет", weight: "11,8 кг", best: "Ниже ориентировочная цена", href: "/catalog/sverlenie/magnitnye-stanki" },
  { name: "LENZ STEYR-35 MAX", image: "/products/lenz-steyr-35.jpg", price: "77 910 ₽", availability: "Уточняем", diameter: "35 мм", spiral: "13 мм", power: "1 600 Вт", spindle: "Weldon 19", speeds: "6", reverse: "Есть", weight: "12,4 кг", best: "Резьба и регулировка", href: "/catalog/sverlenie/magnitnye-stanki" },
];

const rows: Array<[string, keyof typeof models[number], number?]> = [
  ["Ориентировочная цена с НДС", "price", 1], ["Наличие и срок", "availability"], ["Корончатое сверло", "diameter", 1], ["Спиральное сверло", "spiral"], ["Мощность", "power", 2], ["Шпиндель", "spindle"], ["Количество скоростей", "speeds", 2], ["Реверс", "reverse", 2], ["Масса", "weight", 0],
];

export default function ComparePage() {
  return <div className="site-shell"><PilotHeader /><main className="inner-page">
    <div className="container"><Breadcrumbs items={[{label:"Главная",href:"/"},{label:"Магнитные станки",href:"/catalog/sverlenie/magnitnye-stanki"},{label:"Сравнение"}]} /></div>
    <section className="compare-hero"><div className="container compare-heading"><div><p className="eyebrow">Сравнение по решающим параметрам</p><h1>Три модели — одна таблица</h1><p>Сравнение помогает сузить выбор. Финальную применимость, цену, наличие и срок подтверждаем под конкретный запрос.</p></div><div><b>Нужен вывод специалиста?</b><span>Отправим рекомендацию с подтверждёнными условиями поставки.</span><a href="mailto:info@7tool.ru?subject=Сравнение%20магнитных%20станков">Получить сравнение на email</a></div></div></section>
    <section className="compare-section"><div className="container compare-scroll"><table className="comparison-table">
      <thead><tr><th>Параметр</th>{models.map((model) => <th key={model.name}><Image src={model.image} alt={model.name} width={180} height={150} /><span>{model.best}</span><b>{model.name}</b><Link href={model.href}>Открыть модель →</Link></th>)}</tr></thead>
      <tbody>{rows.map(([label,key,bestIndex]) => <tr key={label}><th>{label}</th>{models.map((model,index) => <td className={bestIndex === index ? "best-value" : ""} key={model.name}>{model[key]}{bestIndex === index && <small>Преимущество</small>}</td>)}</tr>)}</tbody>
    </table></div></section>
    <section className="compare-decision"><div className="container"><div><p className="eyebrow">Предварительный вывод</p><h2>Как сузить выбор</h2></div><div><b>Монтаж и отверстия до Ø35</b><span>STEYR-35 легче; применимость проверим по вашим условиям.</span></div><div><b>Ограниченный бюджет</b><span>DM-36K имеет более низкий ориентир цены; срок нужно подтвердить.</span></div><div><b>Нарезание резьбы</b><span>STEYR-35 MAX оснащён реверсом и шестью скоростями.</span></div></div></section>
  </main><PilotFooter /></div>;
}
