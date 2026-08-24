import { redirect } from "next/navigation";
import { getCurrentSession, login } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const session = await getCurrentSession();
  if (session) redirect(sp.next ?? "/admin");

  async function action(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const next = String(formData.get("next") ?? "/admin");
    const r = await login(email, password);
    if (!r.ok) {
      redirect(`/admin/login?error=${encodeURIComponent(r.error)}&next=${encodeURIComponent(next)}`);
    }
    redirect(next);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-steel-50 px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-card)] border border-steel-200 bg-white p-7 shadow-elev">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">7TOOL · Admin</div>
        <h1 className="mt-2 font-display text-[24px] font-extrabold tracking-tight text-steel-900">Вход в админку</h1>

        {sp.error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
            {sp.error}
          </div>
        )}

        <form action={action} className="mt-5 grid gap-3">
          <input type="hidden" name="next" value={sp.next ?? "/admin"} />
          <label className="grid gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-steel-500">
            Email
            <input
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              className="rounded-md border border-steel-200 bg-white px-3 py-2.5 text-[14px] font-normal normal-case tracking-normal text-steel-900 focus:border-amber-400 focus:outline-none"
            />
          </label>
          <label className="grid gap-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-steel-500">
            Пароль
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-md border border-steel-200 bg-white px-3 py-2.5 text-[14px] font-normal normal-case tracking-normal text-steel-900 focus:border-amber-400 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-amber-400 px-4 py-2.5 text-[14px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300"
          >
            Войти
          </button>
        </form>
      </div>
    </main>
  );
}
