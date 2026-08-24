import { redirect } from "next/navigation";
import { changePassword, requireAdmin, verifyPassword, findUserByEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Account({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const session = await requireAdmin();
  const sp = await searchParams;

  async function action(formData: FormData) {
    "use server";
    const cur = String(formData.get("current") ?? "");
    const next = String(formData.get("next") ?? "");
    const next2 = String(formData.get("next2") ?? "");
    if (next.length < 8) redirect("/admin/account?err=Минимум 8 символов");
    if (next !== next2) redirect("/admin/account?err=Пароли не совпадают");
    const u = findUserByEmail(session.user.email);
    if (!u) redirect("/admin/account?err=Пользователь не найден");
    const ok = await verifyPassword(cur, u.password_hash);
    if (!ok) redirect("/admin/account?err=Неверный текущий пароль");
    changePassword(session.user.id, next);
    redirect("/admin/account?ok=1");
  }

  return (
    <section className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:py-10">
      <h1 className="font-display text-[24px] font-extrabold tracking-tight text-steel-900 lg:text-[28px]">Аккаунт</h1>
      <div className="mt-2 text-[13px] text-steel-600">{session.user.email} · роль: {session.user.role}</div>

      <div className="mt-6 rounded-[14px] border border-steel-200 bg-white p-5 shadow-soft">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-amber-700">Сменить пароль</h2>

        {sp.ok === "1" && <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">Пароль обновлён.</div>}
        {sp.err && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{sp.err}</div>}

        <form action={action} className="mt-4 grid gap-3">
          <Field name="current" label="Текущий пароль" type="password" />
          <Field name="next" label="Новый пароль" type="password" hint="мин. 8 символов" />
          <Field name="next2" label="Повторите новый" type="password" />
          <button type="submit" className="mt-2 inline-flex w-fit items-center justify-center gap-2 rounded-md bg-amber-400 px-4 py-2 text-[13.5px] font-bold text-steel-900 shadow-amber transition hover:-translate-y-0.5 hover:bg-amber-300">
            Сменить пароль
          </button>
        </form>
      </div>
    </section>
  );
}

function Field({ name, label, type = "text", hint }: { name: string; label: string; type?: string; hint?: string }) {
  return (
    <label className="grid gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-steel-500">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        required
        className="rounded-md border border-steel-200 bg-white px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-steel-900 focus:border-amber-400 focus:outline-none"
      />
      {hint && <span className="text-[11px] font-normal normal-case tracking-normal text-steel-500">{hint}</span>}
    </label>
  );
}
