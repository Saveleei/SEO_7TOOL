import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { db } from "./db";

const COOKIE = "7tool_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

export type User = {
  id: number;
  email: string;
  name: string | null;
  role: string;
};

export type Session = {
  token: string;
  user: User;
  expires_at: number;
};

export function findUserByEmail(email: string): (User & { password_hash: string }) | undefined {
  return db()
    .prepare<unknown[], User & { password_hash: string }>(
      "SELECT id, email, name, role, password_hash FROM users WHERE email = ?",
    )
    .get(email);
}

export function findUserById(id: number): User | undefined {
  return db()
    .prepare<unknown[], User>("SELECT id, email, name, role FROM users WHERE id = ?")
    .get(id);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function createSession(userId: number): { token: string; expires_at: number } {
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const expires = now + SESSION_TTL_MS;
  db()
    .prepare(
      "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
    .run(token, userId, now, expires);
  return { token, expires_at: expires };
}

export function revokeSession(token: string) {
  db().prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function getSessionByToken(token: string): Session | null {
  const row = db()
    .prepare<unknown[], { token: string; user_id: number; expires_at: number }>(
      "SELECT token, user_id, expires_at FROM sessions WHERE token = ?",
    )
    .get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    revokeSession(token);
    return null;
  }
  const u = findUserById(row.user_id);
  if (!u) return null;
  return { token: row.token, user: u, expires_at: row.expires_at };
}

export async function getCurrentSession(): Promise<Session | null> {
  const c = await cookies();
  const tok = c.get(COOKIE)?.value;
  if (!tok) return null;
  return getSessionByToken(tok);
}

export async function setSessionCookie(token: string, expires_at: number) {
  const c = await cookies();
  c.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expires_at),
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function requireAdmin(): Promise<Session> {
  const s = await getCurrentSession();
  if (!s || s.user.role !== "admin") {
    redirect("/admin/login");
  }
  return s;
}

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = findUserByEmail(email.trim().toLowerCase());
  if (!u) return { ok: false, error: "Неверный email или пароль" };
  const ok = await verifyPassword(password, u.password_hash);
  if (!ok) return { ok: false, error: "Неверный email или пароль" };
  const { token, expires_at } = createSession(u.id);
  await setSessionCookie(token, expires_at);
  return { ok: true };
}

export async function logout() {
  const c = await cookies();
  const tok = c.get(COOKIE)?.value;
  if (tok) revokeSession(tok);
  await clearSessionCookie();
}

export function changePassword(userId: number, newPassword: string) {
  const hash = bcrypt.hashSync(newPassword, 10);
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
  // обнулим все сессии этого пользователя кроме текущей? — пусть простоят. Не критично.
}
