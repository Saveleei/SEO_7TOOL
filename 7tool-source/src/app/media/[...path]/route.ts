import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAssetPublicationRightsEligible } from "@/lib/image-intelligence.mjs";
import { resolveMediaStorageKey, storageKeyFromPublicMediaPath } from "@/lib/media-storage.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicVariant = {
  asset_id: string;
  asset_source_id: string | null;
  rights_grant_id: string;
  storage_key: string;
  checksum: string;
  mime: string;
  asset_status: string;
  license_status: string;
  grant_status: string;
  permitted_uses_json: string;
  valid_from: number;
  valid_until: number | null;
  grant_id: string;
  scope_type: "SOURCE" | "ASSET";
  scope_value: string;
  grant_source_id: string | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const storageKey = storageKeyFromPublicMediaPath((await params).path.join("/"));
  if (!storageKey) return new NextResponse("Not found", { status: 404 });
  const filePath = resolveMediaStorageKey(storageKey);
  if (!filePath) return new NextResponse("Not found", { status: 404 });
  const database = db();
  const schema = database.prepare(`
    SELECT COUNT(*) AS count FROM sqlite_schema
    WHERE type = 'table' AND name IN ('media_assets', 'media_variants', 'media_rights_grants')
  `).get() as { count: number };
  if (schema.count !== 3) return new NextResponse("Not found", { status: 404 });
  const row = database.prepare(`
    SELECT a.id AS asset_id, a.source_id AS asset_source_id, a.rights_grant_id,
      v.storage_key, v.checksum, v.mime, a.status AS asset_status,
      a.license_status, g.status AS grant_status, g.permitted_uses_json,
      g.valid_from, g.valid_until, g.id AS grant_id, g.scope_type, g.scope_value,
      g.source_id AS grant_source_id
    FROM media_variants v
    JOIN media_assets a ON a.id = v.media_asset_id
    JOIN media_rights_grants g ON g.id = a.rights_grant_id
    WHERE v.storage_key = ? AND v.status = 'READY'
      AND a.status = 'PROCESSED'
      AND a.license_status IN ('VERIFIED', 'OWNED', 'CONTRACT_APPROVED')
    LIMIT 1
  `).get(storageKey) as PublicVariant | undefined;
  if (!row || !isAssetPublicationRightsEligible({
    id: row.asset_id,
    source_id: row.asset_source_id,
    rights_grant_id: row.rights_grant_id,
  }, {
    id: row.grant_id,
    status: row.grant_status,
    scope_type: row.scope_type,
    scope_value: row.scope_value,
    source_id: row.grant_source_id,
    permitted_uses_json: row.permitted_uses_json,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
  })) return new NextResponse("Not found", { status: 404 });
  const etag = `"${row.checksum}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }
  try {
    const body = await fs.readFile(filePath);
    return new NextResponse(body, {
      headers: {
        "Content-Type": row.mime,
        "Content-Length": String(body.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
