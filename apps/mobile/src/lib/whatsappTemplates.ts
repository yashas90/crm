import type { MessageTemplateVariables } from "@propninja/types/message-templates";
import {
  buildWhatsAppUrlCandidates,
  substituteMessageTemplate,
} from "@propninja/types/message-templates";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";

const STORAGE_KEY = "whatsapp_recent_message_templates";

export type RecentTemplateEntry = {
  id: string;
  name: string;
  usedAt: string;
};

export function buildTemplateVariables(input: {
  leadName?: string;
  agentName?: string;
  projectName?: string | null;
  unitNumber?: string | null;
  priceListedRs?: string | null;
}): MessageTemplateVariables {
  return {
    leadName: input.leadName,
    agentName: input.agentName,
    projectName: input.projectName ?? undefined,
    unitNumber: input.unitNumber ?? undefined,
    priceListedRs: input.priceListedRs ?? undefined,
  };
}

export function previewTemplate(content: string, vars: MessageTemplateVariables): string {
  return substituteMessageTemplate(content, vars);
}

export async function loadRecentTemplates(): Promise<RecentTemplateEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentTemplateEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordRecentTemplate(template: { id: string; name: string }) {
  const existing = await loadRecentTemplates();
  const next: RecentTemplateEntry[] = [
    { id: template.id, name: template.name, usedAt: new Date().toISOString() },
    ...existing.filter((item) => item.id !== template.id),
  ].slice(0, 2);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** Opens WhatsApp with pre-filled message — deep link first, then wa.me fallback. */
export async function openWhatsAppWithMessage(phone: string, message: string): Promise<boolean> {
  const candidates = buildWhatsAppUrlCandidates(phone, message);

  let deepLinkSupported = false;
  try {
    deepLinkSupported = await Linking.canOpenURL("whatsapp://send");
  } catch {
    deepLinkSupported = false;
  }

  const ordered = deepLinkSupported
    ? candidates
    : [candidates[1], candidates[2], candidates[0]].filter(Boolean);

  for (const url of ordered) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // try next
    }
  }

  return false;
}
