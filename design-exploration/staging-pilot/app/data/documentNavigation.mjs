export function resolveDocumentNavigation({
  href,
  currentUrl,
  button = 0,
  metaKey = false,
  ctrlKey = false,
  shiftKey = false,
  altKey = false,
  target = "",
  download = false,
}) {
  if (!href || button !== 0 || metaKey || ctrlKey || shiftKey || altKey || download) return null;
  if (target && target.toLowerCase() !== "_self") return null;

  let destination;
  let current;
  try {
    current = new URL(currentUrl);
    destination = new URL(href, current);
  } catch {
    return null;
  }

  if (!/^https?:$/u.test(destination.protocol) || destination.origin !== current.origin) return null;
  if (destination.pathname === current.pathname && destination.search === current.search && destination.hash) return null;
  return destination.href;
}
