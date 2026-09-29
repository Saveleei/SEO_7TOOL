import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getManagerPageActor } from "../../data/managerAccessPage";
import { canManager, safePreviewReturnTo } from "../../data/managerAccess";
import { isQuoteTestModeEnabled } from "../../data/quoteRequestStore";
import { ManagerAccessForm } from "../../ui/ManagerAccessForm";

export const metadata: Metadata = { title:"Вход в рабочее место — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

export default async function ManagerAccessPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; denied?: string }> }) {
  if (!isQuoteTestModeEnabled()) notFound();
  const params = await searchParams;
  const returnTo = safePreviewReturnTo(params.returnTo);
  const actor = await getManagerPageActor();
  if (actor && canManager(actor, "requests:view") && params.denied !== "1") redirect(returnTo);
  return <main className="manager-access-page"><div className="manager-access-brand"><Link href="/" aria-label="Вернуться на главную 7TOOL">7TOOL</Link><span>Закрытое рабочее место сотрудников</span></div><ManagerAccessForm returnTo={returnTo} denied={params.denied === "1"} /></main>;
}
