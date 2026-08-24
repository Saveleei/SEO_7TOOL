const SALT = "7tl-live-v1";

function fnv(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function hashId(id: string): string {
  const s = SALT + id;
  return fnv(s, 0x811c9dc5).toString(36) + "_" + fnv(s, 0x7a3c5e1f).toString(36);
}
