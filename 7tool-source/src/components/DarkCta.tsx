import { manager } from "@/lib/site-config";
import { ManagerPhoto } from "./ManagerPhoto";

export function DarkCta() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-steel-900 to-cobalt-900 py-16 text-white lg:py-20">
      <div className="absolute -left-40 -top-20 h-[400px] w-[400px] rounded-full bg-amber-400/15 blur-[120px]" />
      <div className="absolute -right-40 bottom-0 h-[360px] w-[360px] rounded-full bg-amber-400/12 blur-[120px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

      <div className="relative mx-auto grid max-w-[1280px] items-center gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_minmax(0,460px)]">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300">
            <span className="h-px w-6 bg-amber-400" /> Подбор под задачу
          </div>
          <h2 className="mt-4 font-display text-[32px] font-extrabold leading-[1.05] tracking-tight lg:text-[44px]">
            Не нашли нужный <span className="text-amber-400">типоразмер</span>?
          </h2>
          <p className="mt-4 max-w-[560px] text-[15.5px] leading-relaxed text-steel-300">
            Расскажите, что обрабатываете и какой материал — инженер подберёт оригинал
            или аналог, согласует цену и сроки. Среднее время ответа — 12 минут.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href={`tel:${manager.phone.replace(/\D/g, "")}`}
              className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-5 py-3 text-[14px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              {manager.phone}
            </a>
            <a
              href="/kontakty"
              className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-5 py-3 text-[14px] font-semibold text-white transition hover:border-amber-300 hover:bg-amber-400/10 hover:text-amber-300"
            >
              Оставить заявку
            </a>
          </div>
        </div>

        <div className="relative rounded-[var(--radius-card)] border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="absolute -inset-px -z-10 rounded-[var(--radius-card)] bg-gradient-to-br from-amber-400/30 via-transparent to-amber-400/10" />
          <div className="flex items-start gap-4">
            <div className="rounded-full ring-2 ring-amber-400 shadow-amber">
              <ManagerPhoto size={72} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-amber-300">
                Дежурный инженер
              </div>
              <div className="mt-0.5 font-display text-[18px] font-extrabold text-white">
                {manager.name}
              </div>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-300 ring-1 ring-emerald-400/30">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]" />
                сейчас на связи
              </div>
            </div>
          </div>
          <ul className="mt-5 grid gap-2.5 text-[13px] text-steel-200">
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />Подберём аналог из наличия, если оригинал под заказ</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />КП с ценой и сроком — за 12 минут</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />Постоплата для юрлиц по реквизитам</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
