import {
  buildWhatsAppUrlCandidates,
  formatWhatsAppPhone,
} from "@propninja/types/message-templates";
import { Alert, Linking } from "react-native";

/** True when API returned a privacy-masked number (e.g. 98XXXXX210). */
export function isMaskedPhoneDisplay(phone: string): boolean {
  return /x/i.test(phone.trim());
}

/** Strip formatting; keep leading + for tel: URLs. */
export function normalizeTelPhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (isMaskedPhoneDisplay(trimmed)) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

/** WhatsApp expects country code + number, digits only (no +). */
export function toWhatsAppDigits(phone: string): string {
  if (isMaskedPhoneDisplay(phone)) return "";
  return formatWhatsAppPhone(phone);
}

/**
 * Opens the native SIM dialer via tel: URL.
 * Skips Linking.canOpenURL — it often returns false on Android even when the dialer works.
 * Prefer `dialLeadPhone` when the UI may show a masked number.
 */
export async function dialPhoneNumber(phone: string): Promise<boolean> {
  if (isMaskedPhoneDisplay(phone)) {
    Alert.alert(
      "Number hidden",
      "Full number is hidden. Open the lead and tap Call again so PropNinja can dial securely.",
    );
    return false;
  }

  const normalized = normalizeTelPhone(phone);
  if (!normalized || normalized.replace(/\D/g, "").length < 10) {
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
  if (isMaskedPhoneDisplay(phone)) {
    Alert.alert(
      "Number hidden",
      "Full number is hidden. Open the lead and tap WhatsApp again so PropNinja can connect securely.",
    );
    return false;
  }

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

  const candidates = message
    ? buildWhatsAppUrlCandidates(phone, message)
    : [
        `whatsapp://send?phone=${digits}`,
        `https://wa.me/${digits}`,
        `https://api.whatsapp.com/send?phone=${digits}`,
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
