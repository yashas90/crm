/** Format Indian mobile numbers as 91-XXXXX-XXXXX while typing. */
export function formatIndianPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 12);

  if (digits.length === 0) return "";

  let normalized = digits;
  if (digits.startsWith("91")) {
    normalized = digits;
  } else if (digits.length <= 10) {
    normalized = `91${digits}`;
  }

  const country = normalized.slice(0, 2);
  const rest = normalized.slice(2);

  if (rest.length <= 5) {
    return rest.length > 0 ? `${country}-${rest}` : country;
  }

  return `${country}-${rest.slice(0, 5)}-${rest.slice(5, 10)}`;
}

export function phoneDigitsForApi(formatted: string): string {
  const digits = formatted.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  return digits.startsWith("+") ? formatted.trim() : `+${digits}`;
}

export function isValidIndianPhone(formatted: string): boolean {
  const digits = formatted.replace(/\D/g, "");
  if (digits.length === 10) return true;
  if (digits.length === 12 && digits.startsWith("91")) return true;
  return false;
}
