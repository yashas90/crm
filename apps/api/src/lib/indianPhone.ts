import { phoneDigits } from "./leadPhone.js";

/** 10-digit Indian mobile starting with 6, 7, 8, or 9. */
export function isValidIndianMobile(phone: string): boolean {
  const digits = phoneDigits(phone);
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return local.length === 10 && /^[6-9]/.test(local);
}
