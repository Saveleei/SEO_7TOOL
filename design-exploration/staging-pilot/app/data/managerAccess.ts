export const MANAGER_SESSION_COOKIE = "7tool_manager_session";

export const MANAGER_CAPABILITIES = [
  "catalog:audit",
  "catalog:manage",
  "requests:view",
  "requests:update",
  "quotes:edit",
  "quotes:approve",
  "quotes:download",
  "settings:manage",
  "delivery:prepare",
] as const;

export type ManagerCapability = typeof MANAGER_CAPABILITIES[number];
export type ManagerRole = "admin" | "manager" | "approver";

export type ManagerActor = {
  id: string;
  email: string;
  name: string;
  role: ManagerRole;
  roleLabel: string;
  source: "local-password" | "platform";
};

const capabilitiesByRole: Record<ManagerRole, readonly ManagerCapability[]> = {
  admin:MANAGER_CAPABILITIES,
  manager:["requests:view", "requests:update", "quotes:edit", "quotes:download"],
  approver:["requests:view", "quotes:approve", "quotes:download"],
};

export function capabilitiesForRole(role: ManagerRole): readonly ManagerCapability[] {
  return capabilitiesByRole[role];
}

export function canManager(actor: ManagerActor, capability: ManagerCapability): boolean {
  return capabilitiesByRole[actor.role].includes(capability);
}

export function managerRoleLabel(role: ManagerRole): string {
  if (role === "admin") return "Администратор";
  if (role === "approver") return "Согласующий";
  return "Менеджер";
}

export function resolvePlatformManagerActor(headers: Headers, env: NodeJS.ProcessEnv = process.env): ManagerActor | null {
  const id = clean(headers.get("oai-authenticated-user-id"), 180);
  const email = normalizeEmail(headers.get("oai-authenticated-user-email"));
  if (!id || !email) return null;
  const role = roleForEmail(email, env);
  if (!role) return null;
  const fullName = platformFullName(headers);
  return {
    id:`platform:${id}`,
    email,
    name:fullName || email,
    role,
    roleLabel:managerRoleLabel(role),
    source:"platform",
  };
}

export function safeManagerReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\r\n]/u.test(value)) return "/test/requests";
  try {
    const parsed = new URL(value, "http://local.test");
    if (parsed.origin !== "http://local.test" || !parsed.pathname.startsWith("/test/")) return "/test/requests";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/test/requests";
  }
}

export function safePreviewReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\r\n]/u.test(value)) return "/";
  try {
    const parsed = new URL(value, "http://local.test");
    if (parsed.origin !== "http://local.test" || parsed.pathname === "/test/access") return "/";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function isLoopbackHostname(value: string): boolean {
  const hostname = normalizeHostname(value);
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function isTestManagerHostname(value: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const hostname = normalizeHostname(value);
  if (isLoopbackHostname(hostname)) return true;
  return new Set(`${env.MANAGER_AUTH_LOCAL_HOSTS || ""},${env.MANAGER_AUTH_TEST_HOSTS || ""}`
    .split(",")
    .map(normalizeHostname)
    .filter(Boolean))
    .has(hostname);
}

export function requestHostname(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwarded || headers.get("host") || "";
  if (host.startsWith("[")) return host.slice(1, host.indexOf("]"));
  return host.split(":")[0] || "";
}

function roleForEmail(email: string, env: NodeJS.ProcessEnv): ManagerRole | null {
  if (emailList(env.MANAGER_AUTH_ADMIN_EMAILS).has(email)) return "admin";
  if (emailList(env.MANAGER_AUTH_APPROVER_EMAILS).has(email)) return "approver";
  if (emailList(env.MANAGER_AUTH_MANAGER_EMAILS).has(email)) return "manager";
  return null;
}

function emailList(value?: string): Set<string> {
  return new Set(String(value || "").split(",").map(normalizeEmail).filter(Boolean));
}

function normalizeEmail(value: string | null | undefined): string {
  const normalized = clean(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized) ? normalized : "";
}

function platformFullName(headers: Headers): string {
  if (headers.get("oai-authenticated-user-full-name-encoding") !== "percent-encoded-utf-8") return "";
  try {
    return clean(decodeURIComponent(headers.get("oai-authenticated-user-full-name") || ""), 120);
  } catch {
    return "";
  }
}

function clean(value: string | null | undefined, maxLength: number): string {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim().slice(0, maxLength);
}

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/^\[/u, "").replace(/\]$/u, "").replace(/\.$/u, "");
}
