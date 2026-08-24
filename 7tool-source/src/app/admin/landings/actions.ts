"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { findLandingCategory, findLandingIntent } from "@/lib/landing-pages";
import { saveLandingContent, type LandingContent } from "@/lib/landing-content-db";
import { storeImage } from "@/lib/upload-storage";

function value(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function assertLanding(categorySlug: string, intentSlug: string) {
  const category = findLandingCategory(categorySlug);
  const intent = category ? findLandingIntent(category, intentSlug) : undefined;
  if (!category || !intent) throw new Error("LANDING_NOT_FOUND");
}

export async function saveLandingContentAction(categorySlug: string, intentSlug: string, formData: FormData) {
  await requireAdmin();
  assertLanding(categorySlug, intentSlug);
  const content: LandingContent = {
    seo: {
      metaTitle: value(formData, "seo_meta_title"),
      metaDescription: value(formData, "seo_meta_description"),
      keywords: value(formData, "seo_keywords"),
      heading: value(formData, "seo_heading"),
      text: value(formData, "seo_text"),
    },
    hero: {
      h1: value(formData, "hero_h1"),
      offer: value(formData, "hero_offer"),
      description: value(formData, "hero_description"),
      responsePromise: value(formData, "hero_response_promise"),
    },
    proof: {
      heading: value(formData, "proof_heading"),
      intro: value(formData, "proof_intro"),
      items: Array.from({ length: 3 }, (_, index) => ({
        title: value(formData, `proof_${index}_title`),
        text: value(formData, `proof_${index}_text`),
        image: value(formData, `proof_${index}_image`),
        imageAlt: value(formData, `proof_${index}_image_alt`),
      })),
    },
    process: {
      heading: value(formData, "process_heading"),
      intro: value(formData, "process_intro"),
      steps: Array.from({ length: 3 }, (_, index) => ({
        title: value(formData, `process_${index}_title`),
        text: value(formData, `process_${index}_text`),
      })),
    },
    cases: {
      heading: value(formData, "cases_heading"),
      intro: value(formData, "cases_intro"),
      items: Array.from({ length: 3 }, (_, index) => ({
        title: value(formData, `case_${index}_title`),
        task: value(formData, `case_${index}_task`),
        result: value(formData, `case_${index}_result`),
        image: value(formData, `case_${index}_image`),
        imageAlt: value(formData, `case_${index}_image_alt`),
      })),
    },
    faq: Array.from({ length: 8 }, (_, index) => ({
      question: value(formData, `faq_${index}_question`),
      answer: value(formData, `faq_${index}_answer`),
    })),
  };
  saveLandingContent(categorySlug, intentSlug, content);
  revalidatePath(`/lp/${categorySlug}/${intentSlug}`);
  redirect(`/admin/landings/${categorySlug}/${intentSlug}?ok=1`);
}

export async function uploadLandingImage(formData: FormData): Promise<{ url: string }> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("FILE_REQUIRED");
  return { url: await storeImage(file, "landings", { width: 1800, height: 1400, quality: 84 }) };
}
