export function TrustRow() {
  const items = [
    { icon: "doc", label: "Постоплата", sub: "счёт-фактура с НДС" },
    { icon: "truck", label: "Доставка по РФ", sub: "ТК или нашей машиной" },
    { icon: "shield", label: "Гарантия 12+ мес", sub: "от производителя" },
    { icon: "cert", label: "Сертификаты", sub: "ТР ТС, паспорт изделия" },
  ];
  return (
    <ul className="mt-8 grid grid-cols-2 gap-3 text-[13px] md:grid-cols-4">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-steel-200 bg-white px-4 py-3 shadow-soft transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-card">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-amber-100 text-amber-700 ring-1 ring-amber-200">
            {it.icon === "doc" && <DocIcon />}
            {it.icon === "truck" && <TruckIcon />}
            {it.icon === "shield" && <ShieldIcon />}
            {it.icon === "cert" && <CertIcon />}
          </span>
          <span className="min-w-0">
            <span className="block font-bold leading-tight text-steel-900">{it.label}</span>
            <span className="mt-0.5 block text-[12px] leading-tight text-steel-500">{it.sub}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function DocIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h4"/></svg>;
}
function TruckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="1" y="6" width="14" height="11" rx="1"/><path d="M15 9h4l3 4v4h-7"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></svg>;
}
function ShieldIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z"/><path d="M9 12l2 2 4-4"/></svg>;
}
function CertIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="9" r="6"/><path d="M9 14v7l3-2 3 2v-7"/><path d="M10 9l1.5 1.5L15 7"/></svg>;
}
