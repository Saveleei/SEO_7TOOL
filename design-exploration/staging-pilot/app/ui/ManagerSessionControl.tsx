"use client";

import { useState } from "react";
import type { ManagerActor } from "../data/managerAccess";

export function ManagerSessionControl({ actor }: { actor: ManagerActor }) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/manager-auth/session", { method:"DELETE" });
    } finally {
      window.location.assign("/test/access");
    }
  }

  return <div className="manager-session-control">
    <span><small>Доступ</small><b>{actor.roleLabel}</b></span>
    <button type="button" onClick={signOut} disabled={pending} aria-label={`Выйти из сессии: ${actor.name}`}>{pending ? "…" : "Выйти"}</button>
  </div>;
}
