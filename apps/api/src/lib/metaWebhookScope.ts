import { env } from "./env.js";
import type { MetaLeadgenWebhookValue } from "./facebook.js";

function parseCommaSeparatedIds(value?: string) {
  if (!value?.trim()) return undefined;
  const ids = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

export function getMetaWebhookScopeConfig() {
  const pageId = env.META_PAGE_ID?.trim() || undefined;
  const formIds = parseCommaSeparatedIds(env.META_FORM_IDS);
  return {
    pageId,
    formIds,
    pageScopingEnabled: Boolean(pageId),
    formScopingEnabled: Boolean(formIds?.length),
  };
}

export function isMetaLeadgenAllowed(change: MetaLeadgenWebhookValue): {
  allowed: boolean;
  reason?: string;
} {
  const { pageId, formIds } = getMetaWebhookScopeConfig();

  if (pageId && change.page_id !== pageId) {
    return { allowed: false, reason: "page_id_mismatch" };
  }

  if (formIds?.length && change.form_id && !formIds.includes(change.form_id)) {
    return { allowed: false, reason: "form_id_not_allowed" };
  }

  return { allowed: true };
}
