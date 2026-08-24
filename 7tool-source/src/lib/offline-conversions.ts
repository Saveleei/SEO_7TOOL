import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import { YANDEX_METRIKA_ID } from "./metrika-config";

export type OfflineTarget = "qualified_call" | "lead_qualified" | "lead_won";

type ConversionRow = {
  id: number;
  target: OfflineTarget;
  conversion_at: number;
  yclid: string | null;
  client_id: string | null;
  revenue: number | null;
};

function conversionId(leadId: number, target: OfflineTarget): string {
  return createHash("sha256").update(`7tool:${leadId}:${target}`).digest("hex").slice(0, 32);
}

export function queueOfflineConversion(leadId: number, target: OfflineTarget, conversionAt: number, revenue?: number | null) {
  db().prepare(`
    INSERT INTO offline_conversions (lead_id, target, conversion_id, state, conversion_at, revenue)
    VALUES (?, ?, ?, 'pending', ?, ?)
    ON CONFLICT(lead_id, target) DO UPDATE SET
      conversion_at = excluded.conversion_at,
      revenue = excluded.revenue,
      state = CASE WHEN offline_conversions.state IN ('uploading', 'accepted', 'processed') THEN offline_conversions.state ELSE 'pending' END,
      upload_error = CASE WHEN offline_conversions.state IN ('uploading', 'accepted', 'processed') THEN offline_conversions.upload_error ELSE NULL END
  `).run(leadId, target, conversionId(leadId, target), conversionAt, revenue ?? null);
}

function pendingRows(limit = 5_000): ConversionRow[] {
  return db().prepare<unknown[], ConversionRow>(`
    SELECT oc.id, oc.target, oc.conversion_at, l.yclid, l.client_id,
      CASE WHEN oc.target = 'lead_won' THEN COALESCE(oc.revenue, l.revenue) ELSE NULL END AS revenue
    FROM offline_conversions oc
    JOIN leads l ON l.id = oc.lead_id
    WHERE (oc.state IN ('pending', 'failed') OR oc.state = 'uploading')
      AND (oc.retry_at IS NULL OR oc.retry_at <= ?)
      AND (l.yclid IS NOT NULL OR l.client_id IS NOT NULL)
      AND l.status NOT IN ('lost', 'spam', 'duplicate', 'test')
    ORDER BY oc.conversion_at ASC
    LIMIT ?
  `).all(Date.now(), Math.max(1, Math.min(limit, 20_000)));
}

function csvCell(value: string | number | null): string {
  let output = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(output)) output = `'${output}`;
  return `"${output.replaceAll('"', '""')}"`;
}

export function buildOfflineCsv(rows = pendingRows()): string {
  const lines = [
    ["Target", "DateTime", "Yclid", "ClientId", "Price", "Currency"].map(csvCell).join(","),
    ...rows.map((row) => [
      row.target,
      Math.min(Math.floor(row.conversion_at / 1_000), Math.floor(Date.now() / 1_000) - 1),
      row.yclid,
      row.client_id,
      row.revenue,
      row.revenue != null ? "RUB" : null,
    ].map(csvCell).join(",")),
  ];
  return `\uFEFF${lines.join("\n")}`;
}

export function offlineCsvSnapshot() {
  const rows = pendingRows();
  return { rows, csv: buildOfflineCsv(rows) };
}

export async function uploadPendingOfflineConversions(): Promise<{
  ok: boolean;
  dryRun: boolean;
  count: number;
  uploadId?: number;
  error?: string;
}> {
  const token = process.env.YANDEX_METRIKA_OAUTH_TOKEN?.trim();
  if (token) await pollAcceptedUploads(token);
  const { rows } = offlineCsvSnapshot();
  if (!rows.length) return { ok: true, dryRun: false, count: 0 };
  if (!token) return { ok: true, dryRun: true, count: rows.length };

  const claimed = rows.filter((row) => db().prepare(`UPDATE offline_conversions
    SET state = 'uploading', attempt_count = attempt_count + 1, retry_at = ?
    WHERE id = ? AND (state IN ('pending', 'failed') OR (state = 'uploading' AND retry_at <= ?))`)
    .run(Date.now() + 15 * 60_000, row.id, Date.now()).changes > 0);
  if (!claimed.length) return { ok: true, dryRun: false, count: 0 };
  const claimedCsv = buildOfflineCsv(claimed);

  const body = new FormData();
  body.set("file", new Blob([claimedCsv], { type: "text/csv;charset=utf-8" }), "7tool-offline-conversions.csv");
  try {
    const response = await fetch(
      `https://api-metrika.yandex.net/management/v1/counter/${YANDEX_METRIKA_ID}/offline_conversions/upload?type=BASIC&comment=${encodeURIComponent("7TOOL automated upload")}`,
      { method: "POST", headers: { Authorization: `OAuth ${token}` }, body },
    );
    const responseText = await response.text();
    if (!response.ok) throw new Error(`Yandex Metrika HTTP ${response.status}: ${responseText.slice(0, 700)}`);
    const parsed = JSON.parse(responseText) as { uploading?: UploadingStatus };
    const uploading = parsed.uploading;
    if (!uploading?.id || !Number.isInteger(uploading.id)) throw new Error("Yandex Metrika did not return an upload id");
    const now = Date.now();
    const ids = claimed.map((row) => row.id);
    const placeholders = ids.map(() => "?").join(",");
    const emptyUpload = uploading.source_quantity != null && uploading.source_quantity > 0 && uploading.line_quantity === 0;
    db().prepare(`UPDATE offline_conversions SET state = ?, uploaded_at = ?, retry_at = ?, upload_error = ?,
      provider_upload_id = ?, provider_status = ?, source_quantity = ?, line_quantity = ?
      WHERE id IN (${placeholders})`)
      .run(
        emptyUpload ? "rejected" : "accepted",
        now,
        emptyUpload ? null : now + 15 * 60_000,
        emptyUpload ? "Yandex rejected every row during upload validation" : null,
        uploading.id,
        uploading.status || "PREPARED",
        uploading.source_quantity ?? null,
        uploading.line_quantity ?? null,
        ...ids,
      );
    return { ok: !emptyUpload, dryRun: false, count: claimed.length, uploadId: uploading.id,
      ...(emptyUpload ? { error: "Yandex rejected every uploaded row" } : {}) };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 1_000);
    const ids = claimed.map((row) => row.id);
    const placeholders = ids.map(() => "?").join(",");
    db().prepare(`UPDATE offline_conversions SET state = 'failed', retry_at = ?, upload_error = ? WHERE id IN (${placeholders})`)
      .run(Date.now() + 60 * 60_000, message, ...ids);
    return { ok: false, dryRun: false, count: claimed.length, error: message };
  }
}

type UploadingStatus = {
  id?: number;
  status?: string;
  source_quantity?: number;
  line_quantity?: number;
};

async function pollAcceptedUploads(token: string): Promise<void> {
  const uploads = db().prepare<unknown[], { provider_upload_id: number }>(`
    SELECT DISTINCT provider_upload_id FROM offline_conversions
    WHERE state = 'accepted' AND provider_upload_id IS NOT NULL AND (retry_at IS NULL OR retry_at <= ?)
  `).all(Date.now());
  for (const item of uploads) {
    try {
      const response = await fetch(
        `https://api-metrika.yandex.net/management/v1/counter/${YANDEX_METRIKA_ID}/offline_conversions/uploading/${item.provider_upload_id}`,
        { headers: { Authorization: `OAuth ${token}` } },
      );
      const responseText = await response.text();
      if (!response.ok) throw new Error(`Yandex Metrika status HTTP ${response.status}: ${responseText.slice(0, 700)}`);
      const parsed = JSON.parse(responseText) as { uploading?: UploadingStatus; uploadings?: UploadingStatus[] };
      const uploading = parsed.uploading ?? parsed.uploadings?.find((candidate) => candidate.id === item.provider_upload_id);
      if (!uploading) throw new Error("Yandex Metrika did not return upload status");
      const status = String(uploading.status || "UNKNOWN").toUpperCase();
      const processed = status === "PROCESSED";
      const rejected = status === "LINKAGE_FAILURE";
      db().prepare(`UPDATE offline_conversions SET state = ?, provider_status = ?, source_quantity = ?,
        line_quantity = ?, retry_at = ?, upload_error = ? WHERE provider_upload_id = ? AND state = 'accepted'`)
        .run(
          processed ? "processed" : rejected ? "rejected" : "accepted",
          status,
          uploading.source_quantity ?? null,
          uploading.line_quantity ?? null,
          processed || rejected ? null : Date.now() + 15 * 60_000,
          rejected ? "Yandex Metrika could not link the uploaded identifiers" : null,
          item.provider_upload_id,
        );
    } catch (error) {
      db().prepare(`UPDATE offline_conversions SET retry_at = ?, upload_error = ?
        WHERE provider_upload_id = ? AND state = 'accepted'`)
        .run(
          Date.now() + 30 * 60_000,
          (error instanceof Error ? error.message : String(error)).slice(0, 1_000),
          item.provider_upload_id,
        );
    }
  }
}
