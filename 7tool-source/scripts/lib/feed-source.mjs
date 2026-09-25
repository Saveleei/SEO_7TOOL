import fs from "node:fs";

const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;

export async function loadSupplierFeed(options = {}) {
  const feedUrl = String(options.feedUrl || "").trim();
  const localFeed = String(options.localFeed || "").trim();
  const explicitLocalFile = options.explicitLocalFile === true;
  const allowLocalFallback = options.allowLocalFallback === true;
  const fetchImpl = options.fetchImpl ?? fetch;
  const attempts = boundedInteger(options.attempts, 1, 5, 2);
  const timeoutMs = boundedInteger(options.timeoutMs, 1_000, 300_000, 90_000);
  const maxBytes = boundedInteger(options.maxBytes, 1_024, 512 * 1024 * 1024, DEFAULT_MAX_BYTES);
  const wait = options.wait ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));

  if (explicitLocalFile) return readLocalFeed(localFeed, maxBytes, "local-explicit");
  if (!feedUrl) return readLocalFeed(localFeed, maxBytes, "local-only");

  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(feedUrl, { signal:AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = Number(response.headers?.get?.("content-length"));
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error(`размер фида ${contentLength} байт превышает лимит ${maxBytes}`);
      }
      const xml = await response.text();
      assertFeedSize(xml, maxBytes);
      return { xml, source:"remote", attempt };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(Math.min(1_000 * attempt, 3_000));
    }
  }

  if (allowLocalFallback && localFeed && fs.existsSync(localFeed)) {
    return readLocalFeed(localFeed, maxBytes, "local-fallback");
  }
  throw new Error(`Не удалось загрузить свежий фид после ${attempts} попыток; последний корректный снимок сохранён`, { cause:lastError });
}
function readLocalFeed(filePath, maxBytes, source) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("FEED_URL is required when no explicit local feed is available");
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error(`Локальный фид не является файлом: ${filePath}`);
  if (stat.size > maxBytes) throw new Error(`размер фида ${stat.size} байт превышает лимит ${maxBytes}`);
  const xml = fs.readFileSync(filePath, "utf8");
  assertFeedSize(xml, maxBytes);
  return { xml, source, attempt:0 };
}

function assertFeedSize(xml, maxBytes) {
  const bytes = Buffer.byteLength(xml, "utf8");
  if (bytes === 0) throw new Error("Получен пустой фид");
  if (bytes > maxBytes) throw new Error(`размер фида ${bytes} байт превышает лимит ${maxBytes}`);
}

function boundedInteger(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}
