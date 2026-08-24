"use client";

import Link from "next/link";
import type { PublicSemanticLinkSet } from "@/lib/semantic-linking-db";
import { trackEvent } from "@/lib/analytics";

export function SemanticNextSteps({
  links, className = "", articleAnalytics,
}: {
  links?: PublicSemanticLinkSet;
  className?: string;
  articleAnalytics?: { articleId: string; category: string };
}) {
  if (!links?.items.length) return null;
  return (
    <section className={`border-y border-cobalt-200 bg-cobalt-50/50 ${className}`} aria-labelledby={`semantic-next-${links.id}`}>
      <div className="mx-auto max-w-[980px] px-4 py-10 sm:px-6 sm:py-12">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cobalt-700">Навигация по задаче</div>
        <h2 id={`semantic-next-${links.id}`} className="mt-2 font-display text-[25px] font-extrabold tracking-tight text-steel-900">
          Следующий логичный вопрос
        </h2>
        <ol className="mt-6 grid gap-3 md:grid-cols-2">
          {links.items.map((item, index) => (
            <li key={item.id} className="rounded-[12px] border border-cobalt-100 bg-white p-5 shadow-soft">
              <div className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cobalt-700 text-[11px] font-extrabold text-white" aria-hidden>
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-[14px] font-bold leading-6 text-steel-900">{item.nextQuestion}</h3>
                  <Link href={item.href} onClick={() => {
                    if (!articleAnalytics) return;
                    if (item.relationType === "ARTICLE_TO_PRODUCT") {
                      trackEvent("PRODUCT_CLICK_FROM_ARTICLE", {
                        page_type: "article", content_id: articleAnalytics.articleId,
                        category: articleAnalytics.category, product_id: item.targetId,
                        placement: "semantic_next_step",
                      });
                    } else if (item.relationType === "ARTICLE_TO_CATEGORY") {
                      trackEvent("CATEGORY_CLICK_FROM_ARTICLE", {
                        page_type: "article", content_id: articleAnalytics.articleId,
                        category: articleAnalytics.category, placement: "semantic_next_step",
                      });
                    }
                  }} className="mt-2 inline-flex text-[13px] font-extrabold text-cobalt-700 underline decoration-cobalt-200 underline-offset-4 transition hover:text-cobalt-900">
                    {item.anchorText}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[11px] leading-5 text-steel-500">Переходы опубликованы после редакционной проверки.</p>
      </div>
    </section>
  );
}
