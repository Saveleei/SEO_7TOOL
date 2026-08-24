import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { Breadcrumbs } from "./Breadcrumbs";

export type InfoSection = { title: string; paragraphs: string[]; list?: string[] };

export function InfoPage({
  title,
  lead,
  sections,
  needsOwnerConfirmation = false,
}: {
  title: string;
  lead: string;
  sections: InfoSection[];
  needsOwnerConfirmation?: boolean;
}) {
  return (
    <>
      <SiteHeader />
      <main>
        <header className="border-b border-steel-200 bg-steel-900 text-white">
          <div className="mx-auto max-w-[980px] px-4 py-8 sm:px-6 sm:py-12">
            <div className="text-steel-300"><Breadcrumbs items={[{ label: "Главная", href: "/" }, { label: title }]} /></div>
            <h1 className="mt-5 font-display text-[30px] font-black tracking-tight sm:text-[44px]">{title}</h1>
            <p className="mt-3 max-w-[760px] text-[14.5px] leading-7 text-steel-200">{lead}</p>
          </div>
        </header>
        <div className="mx-auto max-w-[980px] px-4 py-10 sm:px-6 sm:py-14">
          {needsOwnerConfirmation && (
            <div className="mb-8 rounded-[12px] border-2 border-amber-400 bg-amber-50 px-4 py-3 text-[13px] font-extrabold uppercase tracking-wide text-amber-900">
              Требует подтверждения владельцем: юридические реквизиты, сроки и условия ниже должны быть сверены перед публикацией.
            </div>
          )}
          <div className="space-y-9">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="font-display text-[22px] font-extrabold text-steel-900">{section.title}</h2>
                <div className="mt-3 space-y-3 text-[14px] leading-7 text-steel-700">
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.list && <ul className="list-disc space-y-1 pl-5">{section.list.map((item) => <li key={item}>{item}</li>)}</ul>}
                </div>
              </section>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
