const QUOTE_REQUEST_ID = /^7T-\d{8}-[A-F0-9]{6}$/u;
const STAFF_REQUEST_BASE = "https://7tool.ru/test/requests/";

export function leadAttachmentWorkspaceUrl(payload) {
  if (!Array.isArray(payload?.uploadedFiles) || payload.uploadedFiles.length === 0) return null;
  const requestId = typeof payload?.extra?.newRequestId === "string"
    ? payload.extra.newRequestId.trim().toUpperCase()
    : "";
  return QUOTE_REQUEST_ID.test(requestId)
    ? `${STAFF_REQUEST_BASE}${encodeURIComponent(requestId)}`
    : null;
}
