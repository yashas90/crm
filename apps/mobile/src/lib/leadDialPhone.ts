import { apiGet } from "@/lib/apiClient";
import {
  dialPhoneNumber as dialResolvedPhone,
  isMaskedPhoneDisplay,
  openWhatsAppChat as openWhatsAppWithPhone,
} from "@/lib/phoneActions";
import { Alert } from "react-native";

export type DialPhoneWhich = "primary" | "secondary";

type DialPhoneResponse = {
  leadId: string;
  which: DialPhoneWhich;
  phone: string;
};

/**
 * Fetch the real phone for dialing when list/detail only has a masked display value.
 * Admins already receive full numbers in lead payloads — those dial without this call.
 */
export async function fetchLeadDialPhone(
  leadId: string,
  which: DialPhoneWhich = "primary",
): Promise<string | null> {
  try {
    const data = await apiGet<DialPhoneResponse>(`/api/leads/${leadId}/dial-phone?which=${which}`, {
      skipOfflineQueue: true,
    });
    return data.phone?.trim() || null;
  } catch {
    return null;
  }
}

/** Resolve a display phone (possibly masked) to a dialable E.164 / digits string. */
export async function resolveDialablePhone(options: {
  leadId?: string | null;
  phone?: string | null;
  which?: DialPhoneWhich;
}): Promise<string | null> {
  const display = options.phone?.trim() ?? "";
  if (display && !isMaskedPhoneDisplay(display)) {
    return display;
  }
  if (!options.leadId) return null;
  return fetchLeadDialPhone(options.leadId, options.which ?? "primary");
}

export async function dialLeadPhone(options: {
  leadId?: string | null;
  phone?: string | null;
  which?: DialPhoneWhich;
}): Promise<{ opened: boolean; phone: string | null }> {
  const phone = await resolveDialablePhone(options);
  if (!phone) {
    Alert.alert(
      "Number unavailable",
      "Could not load this lead’s phone number. Check your connection and try again.",
    );
    return { opened: false, phone: null };
  }
  const opened = await dialResolvedPhone(phone);
  return { opened, phone: opened ? phone : null };
}

export async function openLeadWhatsApp(options: {
  leadId?: string | null;
  phone?: string | null;
  which?: DialPhoneWhich;
  leadName?: string;
  message?: string;
}): Promise<boolean> {
  const phone = await resolveDialablePhone(options);
  if (!phone) {
    Alert.alert(
      "Number unavailable",
      "Could not load this lead’s phone number for WhatsApp. Check your connection and try again.",
    );
    return false;
  }
  return openWhatsAppWithPhone(phone, {
    leadName: options.leadName,
    message: options.message,
  });
}
