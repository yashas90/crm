import { Alert, Linking } from "react-native";

/** Strip formatting; keep leading + for tel: URLs. */
export function normalizeTelPhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

/** WhatsApp expects country code + number, digits only (no +). */
export function toWhatsAppDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = `91${digits.slice(1)}`;
  } else if (digits.length === 12 && digits.startsWith("91")) {
    // already fine
  }
  return digits;
}

/**
 * Opens the native SIM dialer via tel: URL.
 * Skips Linking.canOpenURL — it often returns false on Android even when the dialer works.
 */
export async function dialPhoneNumber(phone: string): Promise<boolean> {
  const normalized = normalizeTelPhone(phone);
  if (!normalized) {
    Alert.alert("No number", "This lead does not have a valid phone number.");
    return false;
  }

  const urls = [`tel:${normalized}`, `tel://${normalized}`];

  for (const url of urls) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // try next format
    }
  }

  Alert.alert(
    "Dialer unavailable",
    "Could not open the phone app. Use a physical phone with a SIM, or try WhatsApp instead.",
  );
  return false;
}

/** One-tap WhatsApp chat — app deep link with wa.me fallback. */
export async function openWhatsAppChat(
  phone: string,
  options?: { message?: string; leadName?: string },
): Promise<boolean> {
  const digits = toWhatsAppDigits(phone);
  if (!digits || digits.length < 10) {
    Alert.alert("No number", "This lead does not have a valid phone number for WhatsApp.");
    return false;
  }

  const defaultMessage =
    options?.leadName != null
      ? `Hi ${options.leadName}, I'm reaching out from PropNinja regarding your property inquiry.`
      : undefined;
  const message = options?.message ?? defaultMessage;
  const textParam = message ? `?text=${encodeURIComponent(message)}` : "";

  const candidates = [
    `whatsapp://send?phone=${digits}${message ? `&text=${encodeURIComponent(message)}` : ""}`,
    `https://wa.me/${digits}${textParam}`,
    `https://api.whatsapp.com/send?phone=${digits}${message ? `&text=${encodeURIComponent(message)}` : ""}`,
  ];

  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // try next URL
    }
  }

  Alert.alert(
    "WhatsApp unavailable",
    "Install WhatsApp or check that the phone number includes a valid country code.",
  );
  return false;
}
