"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { trackEvent, trackEventOnce, type AnalyticsEvent } from "@/lib/analytics";

type ArticleEvent = "PRODUCT_CLICK_FROM_ARTICLE" | "CATEGORY_CLICK_FROM_ARTICLE";

export function ArticleAnalytics({ articleId, category, targetId }: { articleId: string; category: string; targetId: string }) {
  useEffect(() => {
    const params = { page_type: "article", content_id: articleId, category } as const;
    trackEventOnce(`article-view:${articleId}`, "ARTICLE_VIEW", params);
    let frame = 0;
    function measure() {
      frame = 0;
      const article = document.getElementById(targetId);
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const progress = Math.max(0, Math.min(1, (window.scrollY + window.innerHeight - top) / Math.max(article.scrollHeight, 1)));
      if (progress >= 0.5) trackEventOnce(`article-scroll-50:${articleId}`, "ARTICLE_50_SCROLL", params);
      if (progress >= 0.9) trackEventOnce(`article-scroll-90:${articleId}`, "ARTICLE_90_SCROLL", params);
    }
    function scheduleMeasure() {
      if (!frame) frame = window.requestAnimationFrame(measure);
    }
    measure();
    window.addEventListener("scroll", scheduleMeasure, { passive: true });
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      window.removeEventListener("scroll", scheduleMeasure);
      window.removeEventListener("resize", scheduleMeasure);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [articleId, category, targetId]);
  return null;
}

export function TrackedArticleLink({
  href, event, articleId, category, productId, className, children,
}: {
  href: string;
  event: ArticleEvent;
  articleId: string;
  category: string;
  productId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent(event as AnalyticsEvent, {
        page_type: "article", content_id: articleId, category,
        product_id: productId, placement: productId ? "article_products" : "article_category",
      })}
    >
      {children}
    </Link>
  );
}
