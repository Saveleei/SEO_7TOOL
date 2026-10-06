import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const FALLBACK_SITE_URL = "https://7tool.ru";
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_TTL_SECONDS = 30 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 32;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

function normalizeSiteUrl(value) {
  try {
    const url = new URL(String(value || FALLBACK_SITE_URL));
    if (!/^https?:$/u.test(url.protocol)) return FALLBACK_SITE_URL;
    return `${url.protocol}//${url.host}`;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

function normalizeTtlSeconds(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 60) return DEFAULT_TTL_SECONDS;
  return Math.min(parsed, MAX_TTL_SECONDS);
}

function normalizedSecret(value) {
  const secret = typeof value === "string" ? value.trim() : "";
  return secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function fileFingerprint(file) {
  if (!file || typeof file.path !== "string" || !file.path) return null;
  return createHash("sha256").update(JSON.stringify({
    kind: file.kind || "",
    path: file.path,
    originalName: file.originalName || "",
    size: Number(file.size) || 0,
    scanStatus: file.scanStatus || "",
  })).digest("base64url");
}

function signaturePayload(leadId, fileIndex, expiresAt, fingerprint) {
  return `7tool-lead-attachment:v1:${leadId}:${fileIndex}:${expiresAt}:${fingerprint}`;
}

function signAttachment({ leadId, fileIndex, expiresAt, file, secret }) {
  const fingerprint = fileFingerprint(file);
  const signingSecret = normalizedSecret(secret);
  if (!fingerprint || !signingSecret) return null;
  return createHmac("sha256", signingSecret)
    .update(signaturePayload(leadId, fileIndex, expiresAt, fingerprint))
    .digest("base64url");
}

export function leadAttachmentDownloadLinks(payload, leadId, options = {}) {
  if (!Number.isInteger(leadId) || leadId <= 0 || !Array.isArray(payload?.uploadedFiles)) return [];
  const secret = normalizedSecret(options.secret ?? process.env.LEAD_ATTACHMENT_LINK_SECRET);
  if (!secret) return [];
  const nowSeconds = Math.floor(Number(options.nowMs ?? Date.now()) / 1000);
  const ttlSeconds = normalizeTtlSeconds(options.ttlSeconds ?? process.env.LEAD_ATTACHMENT_LINK_TTL_SECONDS);
  const expiresAt = nowSeconds + ttlSeconds;
  const siteUrl = normalizeSiteUrl(options.siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL);

  return payload.uploadedFiles.flatMap((file, fileIndex) => {
    const signature = signAttachment({ leadId, fileIndex, expiresAt, file, secret });
    if (!signature) return [];
    const url = new URL("/api/lead", siteUrl);
    url.searchParams.set("file", `${leadId}.${fileIndex}`);
    url.searchParams.set("e", String(expiresAt));
    url.searchParams.set("s", signature);
    return [{
      fileIndex,
      kind: file.kind === "requisites" ? "requisites" : "specification",
      name: typeof file.originalName === "string" && file.originalName.trim()
        ? file.originalName.trim()
        : `attachment-${fileIndex + 1}`,
      expiresAt,
      url: url.toString(),
    }];
  });
}

export function verifyLeadAttachmentSignature(input) {
  const leadId = Number(input?.leadId);
  const fileIndex = Number(input?.fileIndex);
  const expiresAt = Number(input?.expiresAt);
  const signature = typeof input?.signature === "string" ? input.signature : "";
  const secret = normalizedSecret(input?.secret ?? process.env.LEAD_ATTACHMENT_LINK_SECRET);
  const nowSeconds = Math.floor(Number(input?.nowMs ?? Date.now()) / 1000);
  if (!Number.isInteger(leadId) || leadId <= 0
    || !Number.isInteger(fileIndex) || fileIndex < 0
    || !Number.isInteger(expiresAt) || expiresAt <= nowSeconds
    || expiresAt - nowSeconds > MAX_TTL_SECONDS
    || !SIGNATURE_PATTERN.test(signature)
    || !secret) return false;
  const expected = signAttachment({ leadId, fileIndex, expiresAt, file: input.file, secret });
  if (!expected) return false;
  const receivedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}
