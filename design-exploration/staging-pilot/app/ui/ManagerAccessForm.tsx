"use client";

import { useState } from "react";

export function ManagerAccessForm({ returnTo, denied = false }: { returnTo: string; denied?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/manager-auth/session", {
        method:"POST",
        headers:{ "content-type":"application/json" },
        body:JSON.stringify({ username, password }),
      });
      const result = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message || "Не удалось выполнить вход.");
      setPassword("");
      window.location.assign(returnTo);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Не удалось выполнить вход.");
      setPassword("");
      setPending(false);
    }
  }

  return <section className="manager-access-card" aria-labelledby="manager-access-title">
    <div className="manager-access-mark" aria-hidden="true">A</div>
    <p className="eyebrow">Админ-панель 7TOOL</p>
    <h1 id="manager-access-title">Вход в управление сайтом</h1>
    <p>{denied ? "Текущей роли недостаточно для этого раздела. Войдите под учётной записью администратора." : "Введите логин и пароль администратора. После входа можно самостоятельно менять главную страницу, фотографии блока доверия и настройки витрины."}</p>
    <div className="manager-access-permissions" aria-label="Права администратора">
      <span>Главная и фото доверия</span><span>Фотографии товаров</span><span>Заявки и коммерческие предложения</span><span>Настройки витрины</span>
    </div>
    <form className="manager-access-form" onSubmit={signIn}>
      <label><span>Логин</span><input type="text" name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required maxLength={120} disabled={pending} /></label>
      <label><span>Пароль</span><input type="password" name="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={512} disabled={pending} /></label>
      <button type="submit" disabled={pending}>{pending ? "Проверяем доступ…" : "Войти в админ-панель"}</button>
    </form>
    <small>Безопасная сессия действует 8 часов. Пароль проверяется только на сервере и не сохраняется в браузере.</small>
    <div className="manager-access-feedback" role="status" aria-live="polite">{error && <p>{error}</p>}</div>
  </section>;
}
