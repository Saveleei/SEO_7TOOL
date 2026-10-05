import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title:"Админ-панель — 7TOOL",
  robots:{ index:false, follow:false, nocache:true },
};
export const dynamic = "force-dynamic";

export default function AdminEntryPage() {
  redirect("/test/settings/homepage");
}
