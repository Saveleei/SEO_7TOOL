import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ContactForm } from "./ContactForm";
import { company } from "@/lib/data";

export const metadata = {
  title: "Контакты",
  description: "Свяжитесь с нами по поводу поставки промышленного инструмента.",
  alternates: { canonical: "/kontakty" },
};

export default function ContactsPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="border-b border-steel-100 bg-gradient-to-b from-white via-cobalt-50/20 to-white">
          <div className="mx-auto max-w-[1280px] px-6 pb-10 pt-8 lg:pt-10">
            <Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: "Контакты" }]} />
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                  <span className="h-px w-6 bg-amber-400" />
                  Контакты
                </div>
                <h1 className="mt-3 font-display text-[32px] font-bold tracking-tight text-steel-900 lg:text-[44px]">
                  Свяжитесь с нами
                </h1>
                <p className="mt-3 max-w-[640px] text-[15px] leading-relaxed text-steel-600">
                  Ответим в рабочее время. Подбираем оборудование и оснастку под производственную задачу.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`tel:${company.phone.replace(/\D/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-5 py-3 text-[14px] font-semibold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  {company.phone}
                </a>
                <a
                  href={`mailto:${company.email}`}
                  className="inline-flex items-center gap-2 rounded-md border border-steel-200 bg-white px-5 py-3 text-[14px] font-semibold text-steel-700 transition hover:border-amber-400 hover:text-amber-700"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z" /><path d="M4 6l8 7 8-7" /></svg>
                  {company.email}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-12 lg:py-14">
          <div className="mx-auto max-w-[1280px] px-6">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-14">
              <div>
                <h2 className="font-display text-[24px] font-semibold text-steel-900">
                  Как с нами работать
                </h2>
                <p className="mt-2 max-w-[560px] text-[14px] text-steel-600">
                  Все юридические и расчётные данные выдаём после согласования заявки. Расскажите о задаче — пришлём КП с ценой и сроком.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <FactCard title="Пн–Пт" body="ответим в рабочее время" />
                  <FactCard title="Постоплата" body="для юрлиц по согласованным условиям" />
                  <FactCard title="КП на запрос" body="с подбором аналогов и сроком" />
                </div>

                <h2 className="mt-12 font-display text-[24px] font-semibold text-steel-900">
                  Прямые контакты
                </h2>
                <ul className="mt-4 grid gap-3 rounded-[var(--radius-card)] border border-steel-100 bg-white p-6 text-[14px] shadow-soft sm:grid-cols-2">
                  <li>
                    <div className="text-[12px] uppercase tracking-[0.14em] text-steel-500">Телефон</div>
                    <a href={`tel:${company.phone.replace(/\D/g, "")}`} className="mt-1 block text-[18px] font-display font-bold text-steel-900 hover:text-amber-700">
                      {company.phone}
                    </a>
                  </li>
                  <li>
                    <div className="text-[12px] uppercase tracking-[0.14em] text-steel-500">Адрес</div>
                    <div className="mt-1 text-[15px] font-display font-bold text-steel-900">{company.address}</div>
                    <div className="text-[12px] text-steel-500">{company.hours}</div>
                  </li>
                  <li>
                    <div className="text-[12px] uppercase tracking-[0.14em] text-steel-500">E-mail</div>
                    <a href={`mailto:${company.email}`} className="mt-1 block text-[18px] font-display font-bold text-steel-900 hover:text-amber-700">
                      {company.email}
                    </a>
                  </li>
                  <li>
                    <div className="text-[12px] uppercase tracking-[0.14em] text-steel-500">Юр. лицо</div>
                    <div className="mt-1 text-[15px] font-display font-bold text-steel-900">{company.legalName}</div>
                    <div className="text-[12px] text-steel-500">Реквизиты — по запросу</div>
                  </li>
                </ul>
              </div>

              <div>
                <ContactForm />
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function FactCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-steel-100 bg-gradient-to-br from-amber-50/40 via-white to-white p-5 shadow-soft">
      <div className="font-display text-[24px] font-bold text-steel-900">{title}</div>
      <div className="mt-1 text-[12.5px] leading-snug text-steel-600">{body}</div>
    </div>
  );
}
