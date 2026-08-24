import "server-only";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 10 * 1024 * 1024;
const execFileAsync = promisify(execFile);
const MIME_BY_EXT: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".csv": ["text/csv", "text/plain", "application/vnd.ms-excel"],
  ".xls": ["application/vnd.ms-excel", "application/octet-stream"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream"],
  ".doc": ["application/msword", "application/octet-stream"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip", "application/octet-stream"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
};

export function privateUploadRoot(): string {
  return path.resolve(process.env.PRIVATE_UPLOAD_DIR || path.join(process.cwd(), "private-uploads"));
}

export function resolvePrivateLeadFile(candidate: string): string | null {
  const root = privateUploadRoot();
  const resolved = path.resolve(candidate);
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

function hasExpectedSignature(ext: string, bytes: Uint8Array): boolean {
  if (ext === ".pdf") return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (ext === ".xlsx" || ext === ".docx") return bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (ext === ".xls" || ext === ".doc") return bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
  if (ext === ".csv") return !bytes.slice(0, 4096).some((byte) => byte === 0);
  if (ext === ".jpg" || ext === ".jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (ext === ".png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return false;
}

export type LeadDocumentKind = "specification" | "requisites";

export async function storeLeadDocument(file: File, kind: LeadDocumentKind): Promise<{ path: string; scanStatus: "quarantined" | "clean" }> {
  if (file.size <= 0 || file.size > MAX_BYTES) throw new Error("BAD_FILE_SIZE");
  const ext = path.extname(file.name).toLowerCase();
  const allowedMimes = MIME_BY_EXT[ext];
  if (!allowedMimes || !allowedMimes.includes(file.type || "application/octet-stream")) throw new Error("BAD_FILE_TYPE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasExpectedSignature(ext, bytes)) throw new Error("BAD_FILE_SIGNATURE");
  const root = privateUploadRoot();
  const quarantine = path.join(root, "quarantine");
  await mkdir(quarantine, { recursive: true });
  const filename = `${kind}-${Date.now()}-${randomBytes(16).toString("hex")}${ext}`;
  const target = path.join(quarantine, filename);
  await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  if (process.env.CLAMAV_ENABLED === "1") {
    try {
      await execFileAsync(process.env.CLAMAV_COMMAND || "clamdscan", ["--no-summary", target], { timeout: 30_000, windowsHide: true });
      const accepted = path.join(root, "accepted");
      await mkdir(accepted, { recursive: true });
      const cleanPath = path.join(accepted, filename);
      await rename(target, cleanPath);
      return { path: cleanPath, scanStatus: "clean" };
    } catch (error) {
      const output = error && typeof error === "object" && "stdout" in error ? String(error.stdout) : "";
      if (/FOUND/i.test(output)) {
        await unlink(target).catch(() => undefined);
        throw new Error("VIRUS_DETECTED");
      }
      // При ошибке или недоступности сканера файл остаётся в карантине.
    }
  }
  return { path: target, scanStatus: "quarantined" };
}

export async function storeSpecification(file: File) {
  return storeLeadDocument(file, "specification");
}
