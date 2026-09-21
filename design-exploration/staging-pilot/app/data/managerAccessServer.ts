import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isQuoteTestModeEnabled } from "./quoteRequestStore.ts";
import {
  canManager,
  isTestManagerHostname,
  MANAGER_SESSION_COOKIE,
  managerRoleLabel,
  requestHostname,
  resolvePlatformManagerActor,
  type ManagerActor,
  type ManagerCapability,
} from "./managerAccess.ts";

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SECRET_FILE_NAME = "manager-session.key";
const PASSWORD_HASH_PATTERN = /^pbkdf2-sha256\$(\d{6,7})\$([A-Za-z0-9_-]{16,128})\$([A-Za-z0-9_-]{32,128})$/u;

type ResolveOptions = { dataDir?: string; now?: number };
type AuthResult = { ok: true; actor: ManagerActor } | { ok: false; response: Response };

export async function resolveManagerActor(headers: Headers, options: ResolveOptions = {}): Promise<ManagerActor | null> {
  const platformActor = resolvePlatformManagerActor(headers);
  if (platformActor) return platformActor;
  return resolveLocalManagerActor(headers, options);
}

export async function resolveLocalManagerActor(headers: Headers, options: ResolveOptions = {}): Promise<ManagerActor | null> {
  if (!isQuoteTestModeEnabled() || !isTestManagerHostname(requestHostname(headers))) return null;
  const token = cookieValue(headers.get("cookie"), MANAGER_SESSION_COOKIE);
  if (!token) return null;
  const secret = await readLocalSecret(options.dataDir);
  return secret ? verifyLocalSession(token, secret, options.now) : null;
}

export async function authorizeManagerRequest(request: Request, capability: ManagerCapability, options: ResolveOptions = {}): Promise<AuthResult> {
  const actor = await resolveManagerActor(request.headers, options);
  if (!actor) return { ok:false, response:Response.json({ ok:false, code:"authentication_required", message:"Войдите в рабочее место сотрудника." }, { status:401, headers:{ "Cache-Control":"no-store" } }) };
  if (!canManager(actor, capability)) return { ok:false, response:Response.json({ ok:false, code:"access_denied", message:"Для этого действия недостаточно прав." }, { status:403, headers:{ "Cache-Control":"no-store" } }) };
  return { ok:true, actor };
}

export async function createLocalAdminSession(options: ResolveOptions = {}): Promise<{ token: string; actor: ManagerActor; maxAge: number }> {
  if (!isQuoteTestModeEnabled()) throw new Error("Local manager sign-in is disabled.");
  const secret = await getOrCreateLocalSecret(options.dataDir);
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const payload = { sub:"local-admin", role:"admin", iat:now, exp:now + SESSION_TTL_SECONDS, nonce:randomBytes(12).toString("hex") };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encoded, secret);
  return { token:`${encoded}.${signature}`, actor:localAdminActor(), maxAge:SESSION_TTL_SECONDS };
}

export function localAdminCredentialsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(cleanCredential(env.MANAGER_AUTH_LOCAL_USERNAME, 120) && parsePasswordHash(env.MANAGER_AUTH_LOCAL_PASSWORD_HASH));
}

export function verifyLocalAdminCredentials(username: unknown, password: unknown, env: NodeJS.ProcessEnv = process.env): boolean {
  const expectedUsername = cleanCredential(env.MANAGER_AUTH_LOCAL_USERNAME, 120);
  const suppliedUsername = cleanCredential(username, 120);
  const suppliedPassword = typeof password === "string" && password.length <= 512 ? password : "";
  const parsed = parsePasswordHash(env.MANAGER_AUTH_LOCAL_PASSWORD_HASH);
  if (!expectedUsername || !suppliedUsername || !suppliedPassword || !parsed) return false;
  const derived = pbkdf2Sync(suppliedPassword, parsed.salt, parsed.iterations, parsed.digest.length, "sha256");
  return safeTextEqual(suppliedUsername, expectedUsername) && timingSafeEqual(derived, parsed.digest);
}

export function localSessionCookie(token: string, requestUrl: URL, maxAge = SESSION_TTL_SECONDS): string {
  const secure = requestUrl.protocol === "https:" ? "; Secure" : "";
  return `${MANAGER_SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function clearLocalSessionCookie(requestUrl: URL): string {
  return localSessionCookie("", requestUrl, 0);
}

export function verifyLocalSession(token: string, secret: Buffer, nowMs = Date.now()): ManagerActor | null {
  const [encoded, providedSignature, extra] = token.split(".");
  if (!encoded || !providedSignature || extra || encoded.length > 600 || providedSignature.length > 100) return null;
  const expected = Buffer.from(sign(encoded, secret));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<string, unknown>;
    const now = Math.floor(nowMs / 1000);
    if (payload.sub !== "local-admin" || payload.role !== "admin" || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) return null;
    if (Number(payload.iat) > now + 60 || Number(payload.exp) <= now || Number(payload.exp) - Number(payload.iat) > SESSION_TTL_SECONDS) return null;
    return localAdminActor();
  } catch {
    return null;
  }
}

function localAdminActor(): ManagerActor {
  return { id:"local-admin", email:"", name:"Локальный администратор", role:"admin", roleLabel:managerRoleLabel("admin"), source:"local-demo" };
}

async function getOrCreateLocalSecret(dataDir?: string): Promise<Buffer> {
  const existing = await readLocalSecret(dataDir);
  if (existing) return existing;
  const secretPath = localSecretPath(dataDir);
  await mkdir(path.dirname(secretPath), { recursive:true });
  const value = randomBytes(32).toString("hex");
  try {
    await writeFile(secretPath, value, { encoding:"utf8", flag:"wx", mode:0o600 });
    return Buffer.from(value, "hex");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const raced = await readLocalSecret(dataDir);
    if (!raced) throw new Error("Local manager session key is unavailable.");
    return raced;
  }
}

async function readLocalSecret(dataDir?: string): Promise<Buffer | null> {
  try {
    const value = (await readFile(localSecretPath(dataDir), "utf8")).trim();
    return /^[0-9a-f]{64}$/u.test(value) ? Buffer.from(value, "hex") : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function localSecretPath(dataDir?: string): string {
  const root = dataDir || process.env.QUOTE_TEST_DATA_DIR || path.join(process.cwd(), "work", "quote-requests");
  return path.join(root, "settings", SECRET_FILE_NAME);
}

function sign(payload: string, secret: Buffer): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function parsePasswordHash(value: string | undefined): { iterations: number; salt: Buffer; digest: Buffer } | null {
  const match = String(value || "").match(PASSWORD_HASH_PATTERN);
  if (!match) return null;
  const iterations = Number(match[1]);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return null;
  try {
    const salt = Buffer.from(match[2], "base64url");
    const digest = Buffer.from(match[3], "base64url");
    if (salt.length < 12 || salt.length > 64 || digest.length < 24 || digest.length > 64) return null;
    return { iterations, salt, digest };
  } catch {
    return null;
  }
}

function cleanCredential(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/gu, "").trim().slice(0, maxLength) : "";
}

function safeTextEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function cookieValue(header: string | null, name: string): string {
  for (const chunk of String(header || "").split(";")) {
    const separator = chunk.indexOf("=");
    if (separator < 1 || chunk.slice(0, separator).trim() !== name) continue;
    return chunk.slice(separator + 1).trim();
  }
  return "";
}
