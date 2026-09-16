import { env } from "./env.js";
import { phoneDigits } from "./leadPhone.js";

export const WHATSAPP_GRAPH_API_VERSION = "v21.0";

export type WhatsAppTemplateCategory = "marketing" | "utility" | "authentication";

export type MetaWhatsAppTemplate = {
  name: string;
  language: string;
  category?: string;
  status?: string;
  components?: Array<{
    type: string;
    text?: string;
    format?: string;
    example?: { body_text?: string[][] };
  }>;
};

export type SendTemplateComponent = {
  type: "body" | "header" | "button";
  parameters: Array<{ type: "text"; text: string }>;
};

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.WHATSAPP_API_TOKEN?.trim() && env.WHATSAPP_PHONE_NUMBER_ID?.trim());
}

export function whatsAppVerifyToken(): string {
  return env.WHATSAPP_VERIFY_TOKEN?.trim() || env.META_VERIFY_TOKEN;
}

/** E.164 digits without + for Meta WhatsApp API `to` field. */
export function toWhatsAppRecipient(phone: string): string {
  const digits = phoneDigits(phone);
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}

export function normalizeTemplateCategory(category: string | undefined): WhatsAppTemplateCategory {
  const value = category?.trim().toUpperCase();
  if (value === "UTILITY") return "utility";
  if (value === "AUTHENTICATION") return "authentication";
  return "marketing";
}

/** Extract {{name}} or {{1}} placeholders from template body text. */
export function extractTemplateVariables(components: MetaWhatsAppTemplate["components"]): string[] {
  const variables: string[] = [];
  const seen = new Set<string>();

  for (const component of components ?? []) {
    if (component.type?.toLowerCase() !== "body" || !component.text) continue;
    const matches = component.text.matchAll(/\{\{([^}]+)\}\}/g);
    for (const match of matches) {
      const key = match[1]?.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      variables.push(`{{${key}}}`);
    }
  }

  return variables;
}

export function buildTemplateComponents(
  variableKeys: string[],
  values: Record<string, string>,
): SendTemplateComponent[] {
  if (variableKeys.length === 0) return [];

  const parameters = variableKeys.map((key) => {
    const normalizedKey = key.replace(/^\{\{|\}\}$/g, "").trim();
    const text = values[normalizedKey] ?? values[key] ?? "";
    return { type: "text" as const, text };
  });

  return [{ type: "body", parameters }];
}

export async function fetchWhatsAppBusinessAccountId(): Promise<string | null> {
  const token = env.WHATSAPP_API_TOKEN?.trim();
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;

  const url = new URL(`https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${phoneNumberId}`);
  url.searchParams.set("fields", "whatsapp_business_account");
  url.searchParams.set("access_token", token);

  const response = await fetch(url);
  if (!response.ok) return null;

  const json = (await response.json()) as {
    whatsapp_business_account?: { id?: string };
  };
  return json.whatsapp_business_account?.id ?? null;
}

export async function fetchMetaMessageTemplates(): Promise<MetaWhatsAppTemplate[]> {
  const token = env.WHATSAPP_API_TOKEN?.trim();
  if (!token) {
    throw new Error("WHATSAPP_API_TOKEN is not configured");
  }

  const wabaId = await fetchWhatsAppBusinessAccountId();
  if (!wabaId) {
    throw new Error("Could not resolve WhatsApp Business Account ID from phone number");
  }

  const url = new URL(
    `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${wabaId}/message_templates`,
  );
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", token);

  const response = await fetch(url);
  const json = (await response.json()) as {
    data?: MetaWhatsAppTemplate[];
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(json.error?.message ?? `Meta API error (${response.status})`);
  }

  return json.data ?? [];
}

export type SendWhatsAppTemplateInput = {
  to: string;
  templateName: string;
  language: string;
  components: SendTemplateComponent[];
};

export type SendWhatsAppTemplateResult = {
  waMessageId: string;
};

async function postWhatsAppMessage(
  body: Record<string, unknown>,
): Promise<SendWhatsAppTemplateResult> {
  const token = env.WHATSAPP_API_TOKEN?.trim();
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp API is not configured");
  }

  const url = `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });

  const json = (await response.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number };
  };

  if (!response.ok) {
    throw new Error(json.error?.message ?? `WhatsApp send failed (${response.status})`);
  }

  const waMessageId = json.messages?.[0]?.id;
  if (!waMessageId) {
    throw new Error("WhatsApp API did not return a message id");
  }

  return { waMessageId };
}

export async function sendWhatsAppTemplate(
  input: SendWhatsAppTemplateInput,
): Promise<SendWhatsAppTemplateResult> {
  return postWhatsAppMessage({
    to: toWhatsAppRecipient(input.to),
    type: "template",
    template: {
      name: input.templateName,
      language: { code: input.language },
      ...(input.components.length > 0 ? { components: input.components } : {}),
    },
  });
}

export type WhatsAppInteractiveButton = { id: string; title: string };

export async function sendWhatsAppText(
  to: string,
  text: string,
): Promise<SendWhatsAppTemplateResult> {
  return postWhatsAppMessage({
    to: toWhatsAppRecipient(to),
    type: "text",
    text: { body: text, preview_url: false },
  });
}

export async function sendWhatsAppInteractiveButtons(input: {
  to: string;
  body: string;
  buttons: WhatsAppInteractiveButton[];
}): Promise<SendWhatsAppTemplateResult> {
  if (input.buttons.length > 3) {
    return postWhatsAppMessage({
      to: toWhatsAppRecipient(input.to),
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: input.body.slice(0, 1024) },
        action: {
          button: "Choose",
          sections: [
            {
              title: "Options",
              rows: input.buttons.slice(0, 10).map((button) => ({
                id: button.id.slice(0, 200),
                title: button.title.slice(0, 24),
              })),
            },
          ],
        },
      },
    });
  }

  const buttons = input.buttons.slice(0, 3).map((button) => ({
    type: "reply",
    reply: { id: button.id.slice(0, 256), title: button.title.slice(0, 20) },
  }));

  return postWhatsAppMessage({
    to: toWhatsAppRecipient(input.to),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: input.body.slice(0, 1024) },
      action: { buttons },
    },
  });
}

export async function sendWhatsAppMedia(input: {
  to: string;
  mediaType: "image" | "document" | "video";
  link: string;
  caption?: string;
  filename?: string;
}): Promise<SendWhatsAppTemplateResult> {
  const payload: Record<string, unknown> = { link: input.link };
  if (input.caption) payload.caption = input.caption;
  if (input.mediaType === "document" && input.filename) payload.filename = input.filename;

  return postWhatsAppMessage({
    to: toWhatsAppRecipient(input.to),
    type: input.mediaType,
    [input.mediaType]: payload,
  });
}

export type WhatsAppStatusUpdate = {
  waMessageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp?: number;
  failedReason?: string;
};

export type WhatsAppInboundMessage = {
  waMessageId: string;
  from: string;
  timestamp?: number;
  type: "text" | "button" | "interactive" | "other";
  text: string;
  buttonId?: string;
  contactName?: string;
};

export type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string; payload?: string };
          interactive?: {
            type?: string;
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
          };
        }>;
        statuses?: Array<{
          id?: string;
          status?: string;
          timestamp?: string;
          errors?: Array<{ title?: string; message?: string }>;
        }>;
      };
    }>;
  }>;
};

export function extractWhatsAppInboundMessages(
  body: WhatsAppWebhookPayload,
): WhatsAppInboundMessage[] {
  if (body.object !== "whatsapp_business_account") return [];

  const inbound: WhatsAppInboundMessage[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const contacts = new Map(
        (change.value?.contacts ?? []).map((c) => [c.wa_id ?? "", c.profile?.name ?? ""]),
      );

      for (const message of change.value?.messages ?? []) {
        if (!message.id || !message.from) continue;
        let text = "";
        let type: WhatsAppInboundMessage["type"] = "other";
        let buttonId: string | undefined;

        if (message.text?.body) {
          type = "text";
          text = message.text.body;
        } else if (message.button) {
          type = "button";
          text = message.button.text ?? message.button.payload ?? "";
          buttonId = message.button.payload ?? message.button.text;
        } else if (message.interactive?.button_reply) {
          type = "interactive";
          text = message.interactive.button_reply.title ?? "";
          buttonId = message.interactive.button_reply.id;
        } else if (message.interactive?.list_reply) {
          type = "interactive";
          text = message.interactive.list_reply.title ?? "";
          buttonId = message.interactive.list_reply.id;
        }

        inbound.push({
          waMessageId: message.id,
          from: message.from,
          timestamp: message.timestamp ? Number(message.timestamp) : undefined,
          type,
          text,
          buttonId,
          contactName: contacts.get(message.from) || undefined,
        });
      }
    }
  }

  return inbound;
}

export function extractWhatsAppStatusUpdates(body: WhatsAppWebhookPayload): WhatsAppStatusUpdate[] {
  if (body.object !== "whatsapp_business_account") return [];

  const updates: WhatsAppStatusUpdate[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;

      for (const status of change.value?.statuses ?? []) {
        if (!status.id || !status.status) continue;

        const normalized = status.status.toLowerCase();
        if (!["sent", "delivered", "read", "failed"].includes(normalized)) continue;

        updates.push({
          waMessageId: status.id,
          status: normalized as WhatsAppStatusUpdate["status"],
          timestamp: status.timestamp ? Number(status.timestamp) : undefined,
          failedReason:
            normalized === "failed"
              ? (status.errors?.[0]?.message ?? status.errors?.[0]?.title ?? "Delivery failed")
              : undefined,
        });
      }
    }
  }

  return updates;
}
