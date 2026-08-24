import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { contentForCategory } from "@/lib/category-content";
import { findLandingCategory, findLandingIntent } from "@/lib/landing-pages";
import { getLandingContent, type LandingCase, type LandingImageBlock, type LandingProcessStep } from "@/lib/landing-content-db";
import { saveLandingContentAction } from "../../actions";
import { LandingImagePicker } from "../../LandingImagePicker";

export const dynamic = "force-dynamic";

const proofDefaults: LandingImageBlock[] = [
  { title: "Реальный склад", text: "Товар в наличии отгружаем в день оплаты со склада в Москве или Санкт-Петербурге.", image: "/site/why-stock.webp", imageAlt: "Склад промышленного оборудования 7TOOL" },
  { title: "Инженерный подбор", text: "Специалист проверяет рабочие параметры, совместимость оборудования и оснастки.", image: "/site/why-engineer.webp", imageAlt: "Инженер 7TOOL подбирает промышленное оборудование" },
  { title: "Документы и поставка", text: "Счёт-фактура с НДС, паспорт изделия и сертификаты входят в комплект поставки.", image: "/site/why-documents.webp", imageAlt: "Документы на промышленное оборудование" },
];

const processDefaults: LandingProcessStep[] = [
  { title: "Опишите задачу", text: "Три основных параметра помогают отсечь неподходящие модели." },
  { title: "Получите сравнение", text: "Инженер сверит характеристики и подготовит несколько подходящих вариантов." },
  { title: "Согласуйте поставку", text: "В КП фиксируются цена, наличие, комплектация, документы и срок." },
];

function at<T>(values: T[], index: number, fallback: T): T {
  return values[index] ?? fallback;
}

export default async function EditLandingPage({
  params, searchParams,
}: {
  params: Promise<{ category: string; intent: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  await requireAdmin();
  const { category: categorySlug, intent: intentSlug } = await params;
  const sp = await searchParams;
  const category = findLandingCategory(categorySlug);
  const intent = category ? findLandingIntent(category, intentSlug) : undefined;
  if (!category || !intent) notFound();
  const content = getLandingContent(categorySlug, intentSlug);
  const categorySeo = contentForCategory(categorySlug, category.label);
  const save = saveLandingContentAction.bind(null, categorySlug, intentSlug);
  const faq = content.faq.some((item) => item.question || item.answer) ? content.faq : intent.faq;

  return (
    <section className="mx-auto max-w-[1040px] px-4 py-8 sm:px-6 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/landings" className="text-[12px] text-steel-500 hover:text-amber-700">← Все лендинги</Link>
          <h1 className="mt-1 font-display text-[26px] font-extrabold text-steel-900">{category.label} · {intent.label}</h1>
          <p className="mt-1 text-[12px] text-steel-500">/lp/{categorySlug}/{intentSlug}</p>
        </div>
        <Link href={`/lp/${categorySlug}/${intentSlug}`} target="_blank" className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[12.5px] font-bold text-steel-700 hover:border-amber-400">Открыть лендинг ↗</Link>
      </div>
      {sp.ok === "1" && <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">Настройки сохранены и уже применены.</div>}
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-950">
        Эти данные не участвуют в импорте каталога. Ночное обновление фида их не удалит и не перезапишет.
      </div>

      <form action={save} className="mt-6 grid gap-6">
        <Section title="Первый экран" description="Оставьте поле пустым, чтобы использовать штатный текст сценария.">
          <Field label="H1" name="hero_h1" defaultValue={content.hero.h1 || intent.h1} />
          <Field label="Главное предложение" name="hero_offer" defaultValue={content.hero.offer || intent.offer} />
          <TextArea label="Пояснение" name="hero_description" rows={3} defaultValue={content.hero.description || intent.description} />
          <Field label="Обещание возле формы" name="hero_response_promise" defaultValue={content.hero.responsePromise || "Пришлём 3–5 подходящих моделей с ценами, наличием и сроками в рабочее время."} />
        </Section>

        <Section title="SEO лендинга" description="Уникальные метаданные и полезный текст для поисковых систем. Если поле не менять, используется тематический вариант для этой категории и сценария.">
          <Field label="Meta title" name="seo_meta_title" defaultValue={content.seo.metaTitle || `${intent.h1} — подбор, цены и наличие`} />
          <TextArea label="Meta description" name="seo_meta_description" rows={3} defaultValue={content.seo.metaDescription || `${intent.description} Подбор по параметрам задачи, цены с НДС, наличие и доставка по России.`} />
          <Field label="Ключевые запросы" name="seo_keywords" defaultValue={content.seo.keywords || categorySeo.keywords.join(", ")} />
          <Field label="Заголовок SEO-блока" name="seo_heading" defaultValue={content.seo.heading || categorySeo.seoTitle} />
          <TextArea label="Полезный текст" name="seo_text" rows={6} defaultValue={content.seo.text || categorySeo.seoText.join("\n\n")} />
        </Section>

        <Section title="Доверие и фотографии" description="Используйте только реальные фотографии и подтверждаемые факты. Карточка без заголовка и текста не выводится.">
          <Field label="Заголовок блока" name="proof_heading" defaultValue={content.proof.heading || "Поставляем оборудование, которое можно проверить до оплаты"} />
          <TextArea label="Вводный текст" name="proof_intro" rows={2} defaultValue={content.proof.intro || "Покажите посетителю склад, работу специалистов и комплект поставки — это сильнее общих обещаний."} />
          <div className="grid gap-4">
            {proofDefaults.map((fallback, index) => {
              const item = at(content.proof.items, index, fallback);
              return <ImageTextCard key={index} index={index} prefix="proof" title={`Карточка ${index + 1}`} item={{ ...fallback, ...item }} />;
            })}
          </div>
        </Section>

        <Section title="Как проходит подбор" description="Короткий процесс снижает неопределённость перед отправкой контакта.">
          <Field label="Заголовок блока" name="process_heading" defaultValue={content.process.heading || "От задачи до согласованного КП — три шага"} />
          <TextArea label="Вводный текст" name="process_intro" rows={2} defaultValue={content.process.intro || "Без длинного технического опросника и обязательства оформить заказ."} />
          <div className="grid gap-3 md:grid-cols-3">
            {processDefaults.map((fallback, index) => {
              const step = { ...fallback, ...at(content.process.steps, index, fallback) };
              return <div key={index} className="rounded-lg border border-steel-200 bg-steel-50 p-4"><Field label={`Шаг ${index + 1}`} name={`process_${index}_title`} defaultValue={step.title} /><TextArea label="Текст" name={`process_${index}_text`} rows={3} defaultValue={step.text} /></div>;
            })}
          </div>
        </Section>

        <Section title="Кейсы" description="Блок появится только для заполненных кейсов. Не добавляйте вымышленные результаты.">
          <Field label="Заголовок блока" name="cases_heading" defaultValue={content.cases.heading || "Примеры решённых задач"} />
          <TextArea label="Вводный текст" name="cases_intro" rows={2} defaultValue={content.cases.intro} />
          <div className="grid gap-4">
            {Array.from({ length: 3 }, (_, index) => {
              const item = at<LandingCase>(content.cases.items, index, { title: "", task: "", result: "", image: "", imageAlt: "" });
              return (
                <div key={index} className="rounded-xl border border-steel-200 bg-steel-50 p-4">
                  <h3 className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.12em] text-amber-800">Кейс {index + 1}</h3>
                  <Field label="Название" name={`case_${index}_title`} defaultValue={item.title} />
                  <div className="mt-3 grid gap-3 sm:grid-cols-2"><TextArea label="Задача" name={`case_${index}_task`} rows={3} defaultValue={item.task} /><TextArea label="Результат" name={`case_${index}_result`} rows={3} defaultValue={item.result} /></div>
                  <div className="mt-3"><LandingImagePicker name={`case_${index}_image`} initial={item.image} /></div>
                  <div className="mt-3"><Field label="Alt фотографии" name={`case_${index}_image_alt`} defaultValue={item.imageAlt} /></div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="Вопросы и ответы" description="Пустые пары не выводятся. Можно добавить до восьми вопросов.">
          <div className="grid gap-3">
            {Array.from({ length: 8 }, (_, index) => {
              const item = faq[index] ?? { question: "", answer: "" };
              return <div key={index} className="grid gap-3 rounded-lg border border-steel-200 bg-steel-50 p-4 sm:grid-cols-[.8fr_1.2fr]"><Field label={`Вопрос ${index + 1}`} name={`faq_${index}_question`} defaultValue={item.question} /><TextArea label="Ответ" name={`faq_${index}_answer`} rows={3} defaultValue={item.answer} /></div>;
            })}
          </div>
        </Section>

        <div className="sticky bottom-3 z-20 flex justify-end rounded-xl border border-steel-200 bg-white/95 p-3 shadow-elev backdrop-blur">
          <button type="submit" className="rounded-lg bg-amber-400 px-6 py-3 text-[14px] font-extrabold text-steel-900 shadow-amber hover:bg-amber-300">Сохранить лендинг</button>
        </div>
      </form>
    </section>
  );
}

function ImageTextCard({ index, prefix, title, item }: { index: number; prefix: string; title: string; item: LandingImageBlock }) {
  return <div className="rounded-xl border border-steel-200 bg-steel-50 p-4"><h3 className="mb-3 text-[12px] font-extrabold uppercase tracking-[0.12em] text-amber-800">{title}</h3><div className="grid gap-3 sm:grid-cols-2"><Field label="Заголовок" name={`${prefix}_${index}_title`} defaultValue={item.title} /><TextArea label="Текст" name={`${prefix}_${index}_text`} rows={3} defaultValue={item.text} /></div><div className="mt-3"><LandingImagePicker name={`${prefix}_${index}_image`} initial={item.image} /></div><div className="mt-3"><Field label="Alt фотографии" name={`${prefix}_${index}_image_alt`} defaultValue={item.imageAlt} /></div></div>;
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="grid gap-4 rounded-2xl border border-steel-200 bg-white p-5 shadow-soft"><div><h2 className="font-display text-[20px] font-extrabold text-steel-900">{title}</h2><p className="mt-1 text-[12px] leading-relaxed text-steel-500">{description}</p></div>{children}</section>;
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-steel-500"><span>{label}</span><input name={name} defaultValue={defaultValue} className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[13.5px] font-normal normal-case tracking-normal text-steel-900 focus:border-amber-400 focus:outline-none" /></label>;
}

function TextArea({ label, name, defaultValue, rows }: { label: string; name: string; defaultValue?: string; rows: number }) {
  return <label className="grid gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-steel-500"><span>{label}</span><textarea name={name} defaultValue={defaultValue} rows={rows} className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[13.5px] font-normal normal-case tracking-normal leading-relaxed text-steel-900 focus:border-amber-400 focus:outline-none" /></label>;
}
