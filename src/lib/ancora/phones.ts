export const SELF_NATIONAL = "63992731001";
export const SELF_INTL = "5563992731001";

export function onlyDigits(value: string): string {
  return (value || "").replace(/\D/g, "");
}

/** Canonical storage form: country code 55 when the number is Brazilian local. */
export function canonicalPhone(value: string): string {
  const digits = onlyDigits(value);
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function isSelfPhone(value: string): boolean {
  const digits = onlyDigits(value);
  if (!digits) return false;
  return (
    digits === SELF_NATIONAL ||
    digits === SELF_INTL ||
    digits.endsWith(SELF_NATIONAL)
  );
}

export function phoneLabel(value: string): string {
  const digits = canonicalPhone(value);
  if (digits.length < 12) return digits || "—";
  const ddd = digits.slice(2, 4);
  const rest = digits.slice(4);
  const split = rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` : rest;
  return `+55 ${ddd} ${split}`;
}
