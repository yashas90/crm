export const MESSAGE_TEMPLATE_CATEGORIES = [
  "greeting",
  "project_details",
  "follow_up",
  "site_visit",
  "custom",
] as const;

export type MessageTemplateCategory = (typeof MESSAGE_TEMPLATE_CATEGORIES)[number];

export const MESSAGE_TEMPLATE_VARIABLE_KEYS = [
  "leadName",
  "agentName",
  "projectName",
  "unitNumber",
  "priceListedRs",
] as const;

export type MessageTemplateVariableKey = (typeof MESSAGE_TEMPLATE_VARIABLE_KEYS)[number];

export type MessageTemplateVariables = Partial<
  Record<MessageTemplateVariableKey, string | null | undefined>
>;

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

function formatPriceListedRs(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "";
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return value.trim();
  const n = Number.parseInt(digits, 10);
  if (Number.isNaN(n)) return value.trim();
  return n.toLocaleString("en-IN");
}

function resolveVariable(key: string, vars: MessageTemplateVariables): string {
  switch (key) {
    case "leadName":
      return vars.leadName?.trim() ?? "";
    case "agentName":
      return vars.agentName?.trim() ?? "";
    case "projectName":
      return vars.projectName?.trim() ?? "";
    case "unitNumber":
      return vars.unitNumber?.trim() ?? "";
    case "priceListedRs": {
      const raw = vars.priceListedRs;
      if (raw == null || String(raw).trim() === "") return "";
      return formatPriceListedRs(String(raw));
    }
    default:
      return "";
  }
}

/** Replace `{{variables}}` and drop lines that become empty labels after substitution. */
export function substituteMessageTemplate(content: string, vars: MessageTemplateVariables): string {
  const substituted = content.replace(VARIABLE_PATTERN, (_match, key: string) =>
    resolveVariable(key, vars),
  );

  const lines = substituted.split("\n").map((line) => line.trimEnd());
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^(Unit|Price|Project):\s*₹?\s*$/i.test(trimmed)) return false;
    if (/^₹\s*$/.test(trimmed)) return false;
    return true;
  });

  return cleaned.join("\n").trim();
}

/** WhatsApp expects country code + number, digits only (no +). */
export function formatWhatsAppPhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    digits = `91${digits}`;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    digits = `91${digits.slice(1)}`;
  }
  return digits;
}

export function buildWhatsAppUrl(
  phone: string,
  message: string,
  options?: { preferDeepLink?: boolean },
): string {
  const digits = formatWhatsAppPhone(phone);
  const encoded = encodeURIComponent(message);
  if (options?.preferDeepLink) {
    return `whatsapp://send?phone=${digits}&text=${encoded}`;
  }
  return `https://wa.me/${digits}?text=${encoded}`;
}

export function buildWhatsAppUrlCandidates(phone: string, message: string): string[] {
  const digits = formatWhatsAppPhone(phone);
  const encoded = encodeURIComponent(message);
  return [
    `whatsapp://send?phone=${digits}&text=${encoded}`,
    `https://wa.me/${digits}?text=${encoded}`,
    `https://api.whatsapp.com/send?phone=${digits}&text=${encoded}`,
  ];
}
