import { manager } from "@/lib/site-config";
import { ManagerPhoto } from "./ManagerPhoto";

export function ManagerBlock({ compact = false }: { compact?: boolean }) {
  return (
    <aside className={`relative overflow-hidden rounded-[var(--radius-card)] border border-steel-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/40 ${compact ? "p-4" : "p-5"} shadow-card`}>
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-300/30 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="rounded-full ring-2 ring-amber-300 shadow-amber">
            <ManagerPhoto size={compact ? 56 : 80} />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 ring-2 ring-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-amber-700">
            Ваш персональный менеджер
          </div>
          <div className="mt-0.5 font-display text-[17px] font-bold text-steel-900">
            {manager.name}
          </div>
          {!compact && (
            <p className="mt-1.5 text-[12.5px] leading-snug text-steel-700">
              {manager.promise}
            </p>
          )}
        </div>
      </div>
      <div className="relative mt-4 grid grid-cols-1 gap-2">
        <a
          href={`tel:${manager.phone.replace(/\D/g, "")}`}
          className="inline-flex items-center justify-between gap-2 rounded-md bg-amber-400 px-3.5 py-2.5 text-[13px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
        >
          <span className="inline-flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            {manager.phone}
          </span>
          <span className="text-[10.5px] uppercase tracking-wider opacity-80">позвонить</span>
        </a>
        <a
          href={`mailto:${manager.email}`}
          className="group inline-flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-white px-3.5 py-2.5 text-[13px] font-bold text-steel-900 transition hover:-translate-y-0.5 hover:border-amber-500 hover:bg-amber-50"
        >
          <span className="inline-flex items-center gap-2 min-w-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-amber-600"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
            <span className="truncate">{manager.email}</span>
          </span>
          <span className="text-[10.5px] uppercase tracking-wider text-amber-700 opacity-90 group-hover:opacity-100">написать</span>
        </a>
        <div className="grid grid-cols-2 gap-2">
          <a href={manager.maxUrl} target="_blank" rel="noopener" className="tip flex items-center justify-center gap-1.5 rounded-md border border-steel-200 bg-white py-2 text-[12px] font-bold text-steel-700 transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800" data-tip="Написать в MAX">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.62 7.13L4 21l1.87-5.38A8 8 0 1 1 21 12z" /></svg>
            MAX
          </a>
          <a href={`https://t.me/${manager.telegram}`} target="_blank" rel="noopener" className="tip flex items-center justify-center gap-1.5 rounded-md border border-steel-200 bg-white py-2 text-[12px] font-bold text-steel-700 transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-800" data-tip="Telegram">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
            Telegram
          </a>
        </div>
      </div>
      <div className="relative mt-3 flex items-center gap-1.5 text-[11px] text-steel-500">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
        Сейчас на связи · {manager.hours}
      </div>
    </aside>
  );
}
