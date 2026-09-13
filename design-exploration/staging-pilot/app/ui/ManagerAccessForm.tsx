"use client";

import { useState } from "react";

export function ManagerAccessForm({ returnTo, denied = false }: { returnTo: string; denied?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signIn() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/manager-auth/session", { method:"POST" });
      const result = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message || "Не удалось выполнить вход.");
      window.location.assign(returnTo);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Не удалось выполнить вход.");
      setPending(false);
    }
  }

  return <section className="manager-access-card" aria-labelledby="manager-access-title">
    <div className="manager-access-mark" aria-hidden="true">A</div>
    <p className="eyebrow">Закрытый рабочий контур</p>
    <h1 id="manager-access-title">Вход для сотрудников 7TOOL</h1>
    <p>{denied ? "Текущей роли недостаточно для этого раздела. В локальном стенде можно открыть полную сессию администратора." : "Заявки, клиентские контакты, настройки КП и документы доступны только после серверной проверки прав."}</p>
    <div className="manager-access-permissions" aria-label="Права администратора">
      <span>Все заявки и контакты</span><span>Редактирование и согласование КП</span><span>Реквизиты и печать</span><span>Подготовка пакета отправки</span>
    </div>
    <button type="button" onClick={signIn} disabled={pending}>{pending ? "Открываем защищённую сессию…" : "Войти как администратор"}</button>
    <small>Тестовый вход работает на защищённом тестовом домене и локальном стенде. В production роль назначается по серверному списку разрешённых корпоративных email.</small>
    <div className="manager-access-feedback" aria-live="polite">{error && <p>{error}</p>}</div>
  </section>;
}
