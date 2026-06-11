/** Digit-only form used for fuzzy phone matching within an org. */
export function phoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

/** Common stored/query variants for the same Indian mobile number. */
export function phoneMatchVariants(phone: string) {
  const digits = phoneDigits(phone);
  const variants = new Set<string>();

  const trimmed = phone.replace(/\s+/g, "");
  if (trimmed) variants.add(trimmed);

  if (digits) {
    variants.add(digits);
    if (digits.length === 10) {
      variants.add(`+91${digits}`);
      variants.add(`91${digits}`);
    }
    if (digits.length === 12 && digits.startsWith("91")) {
      variants.add(`+${digits}`);
      variants.add(digits.slice(2));
    }
  }

  return [...variants];
}

/** Prefer E.164-style storage for 10-digit Indian mobiles. */
export function normalizeStoredPhone(phone: string) {
  const trimmed = phone.replace(/\s+/g, "");
  const digits = phoneDigits(trimmed);

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  return trimmed;
}
