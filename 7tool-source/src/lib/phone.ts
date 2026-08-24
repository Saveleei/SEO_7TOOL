// RU phone mask: +7 (XXX) XXX-XX-XX
export function formatPhone(input: string): string {
  let digits = (input || "").replace(/\D/g, "");
  // Если начинается с 8 — заменяем на 7. Если без 7 — добавляем.
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (!digits.startsWith("7")) digits = "7" + digits;
  digits = digits.slice(0, 11);

  const parts: string[] = [];
  parts.push("+7");
  if (digits.length > 1) parts.push(" (" + digits.slice(1, 4));
  if (digits.length >= 4) parts[1] += ")";
  if (digits.length > 4) parts.push(" " + digits.slice(4, 7));
  if (digits.length > 7) parts.push("-" + digits.slice(7, 9));
  if (digits.length > 9) parts.push("-" + digits.slice(9, 11));
  return parts.join("");
}

export function isValidPhone(input: string): boolean {
  return (input || "").replace(/\D/g, "").length === 11;
}
