export function TrustBar() {
  const items = [
    { icon: "star", label: "Дилер Karnasch", sub: "оригинал, прямые поставки" },
    { icon: "doc", label: "Постоплата для юрлиц", sub: "счёт-фактура с НДС" },
    { icon: "truck", label: "Доставка по РФ", sub: "ТК или нашей машиной" },
    { icon: "shield", label: "Гарантия 12+ мес", sub: "от производителя" },
  ];
  return (
    <div className="hidden border-b border-steel-200 bg-gradient-to-r from-amber-50 via-white to-amber-50/40 lg:block">
      <ul className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-6 py-2">
        {items.map((it) => (
          <li key={it.label} className="flex min-w-0 items-center gap-2.5 text-[12.5px]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-700 ring-1 ring-amber-200">
              {it.icon === "star" && <Star />}
              {it.icon === "doc" && <Doc />}
              {it.icon === "truck" && <Truck />}
              {it.icon === "shield" && <Shield />}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block font-bold text-steel-900">{it.label}</span>
              <span className="block text-[11px] text-steel-500">{it.sub}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Star() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6 7 1-5 4 1 7-6-3-6 3 1-7-5-4 7-1z"/></svg>; }
function Doc() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>; }
function Truck() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="1" y="6" width="14" height="11" rx="1"/><path d="M15 9h4l3 4v4h-7"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>; }
function Shield() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>; }
