import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession, logout } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  // Логин-страница рендерится отдельно — без layout-контента (но layout оборачивает её всё равно).
  // Пропускаем layout-чрому, если нет сессии.
  if (!session) {
    return <>{children}</>;
  }
  if (session.user.role !== "admin") {
    redirect("/admin/login");
  }

  async function doLogout() {
    "use server";
    await logout();
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-steel-50 text-steel-900">
      <header className="sticky top-0 z-40 border-b border-steel-200 bg-white/95 shadow-soft backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/admin" className="font-display text-[18px] font-extrabold tracking-tight text-steel-900">
            7TOOL <span className="text-amber-600">· admin</span>
          </Link>
          <nav className="flex flex-1 items-center gap-4 text-[13.5px] font-semibold text-steel-700">
            <Link href="/admin" className="hover:text-amber-700">Дашборд</Link>
            <Link href="/admin/products" className="hover:text-amber-700">Товары</Link>
            <Link href="/admin/categories" className="hover:text-amber-700">Категории</Link>
            <Link href="/admin/subcategories" className="hover:text-amber-700">Подкатегории</Link>
            <Link href="/admin/landings" className="hover:text-amber-700">Лендинги</Link>
            <Link href="/admin/leads" className="hover:text-amber-700">Заявки</Link>
            <Link href="/admin/account" className="hover:text-amber-700">Аккаунт</Link>
            <Link href="/" target="_blank" className="ml-auto hidden text-steel-500 hover:text-amber-700 sm:inline">
              На сайт ↗
            </Link>
          </nav>
          <form action={doLogout}>
            <button
              type="submit"
              className="rounded-md border border-steel-200 bg-white px-3 py-1.5 text-[12.5px] font-bold text-steel-700 transition hover:border-amber-400 hover:text-amber-800"
            >
              {session.user.email} · выйти
            </button>
          </form>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
