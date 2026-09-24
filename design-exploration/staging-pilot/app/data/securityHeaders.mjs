export const SECURITY_RESPONSE_HEADERS = Object.freeze({
  "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
  "Referrer-Policy":"strict-origin-when-cross-origin",
  "X-Content-Type-Options":"nosniff",
  "X-Frame-Options":"SAMEORIGIN",
});

export function applySecurityResponseHeaders(headers) {
  for (const [name, value] of Object.entries(SECURITY_RESPONSE_HEADERS)) {
    headers.set(name, value);
  }
  return headers;
}
