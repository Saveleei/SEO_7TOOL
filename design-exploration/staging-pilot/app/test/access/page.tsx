import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getManagerPageActor } from "../../data/managerAccessPage";
import { canManager, isTestManagerHostname, requestHostname, safePreviewReturnTo } from "../../data/managerAccess";
import { localAdminCredentialsConfigured } from "../../data/managerAccessServer";
import { ManagerAccessForm } from "../../ui/ManagerAccessForm";

export const metadata: Metadata = { title:"Вход в рабочее место — 7TOOL", robots:{ index:false, follow:false, nocache:true } };
export const dynamic = "force-dynamic";

export default async function ManagerAccessPage({ searchParams }: { searchParams: Promise<{ returnTo?: string; denied?: string }> }) {
  const requestHeaders = new Headers(await headers());
  if (!isTestManagerHostname(requestHostname(requestHeaders)) || !localAdminCredentialsConfigured()) notFound();
  const params = await searchParams;
  const returnTo = safePreviewReturnTo(params.returnTo);
  const actor = await getManagerPageActor();
  if (actor && canManager(actor, "requests:view") && params.denied !== "1") redirect(returnTo);
  return <main className="manager-access-page"><div className="manager-access-brand"><Link href="/" aria-label="Вернуться на главную 7TOOL">7TOOL</Link><span>Закрытое рабочее место сотрудников</span></div><ManagerAccessForm returnTo={returnTo} denied={params.denied === "1"} /></main>;
}
