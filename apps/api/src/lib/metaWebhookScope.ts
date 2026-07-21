/**
 * DB-backed Meta Lead Ads webhook scoping.
 *
 * Pages/forms are enabled via `facebook_pages` / `facebook_forms` (`is_active` + `is_selected`).
 * Env `META_PAGE_ID` / `META_FORM_IDS` are NOT used for allowlisting (multi-page model).
 */
import { facebookForms, facebookPages } from "@propninja/db";
import { and, count, eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { db } from "./db.js";
import type { MetaLeadgenWebhookValue } from "./facebook.js";

export type MetaLeadgenScopeResult = {
  allowed: boolean;
  reason?: string;
  pageRowId?: string;
  formRowId?: string;
};

/** True when the org has at least one active selected Page with a stored token. */
export async function hasDbBackedMetaPages(orgId: string = SINGLE_TENANT_ORG_ID): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(facebookPages)
    .where(
      and(
        eq(facebookPages.orgId, orgId),
        eq(facebookPages.isActive, true),
        eq(facebookPages.isSelected, true),
      ),
    );
  return (row?.value ?? 0) > 0;
}

/**
 * Allows a leadgen change only when the Page (and Form, if present) are active + selected in DB.
 */
export async function isMetaLeadgenAllowed(
  change: MetaLeadgenWebhookValue,
  orgId: string = SINGLE_TENANT_ORG_ID,
): Promise<MetaLeadgenScopeResult> {
  if (!change.page_id?.trim()) {
    return { allowed: false, reason: "missing_page_id" };
  }

  const [page] = await db
    .select({
      id: facebookPages.id,
      isActive: facebookPages.isActive,
      isSelected: facebookPages.isSelected,
      hasToken: facebookPages.accessTokenEncrypted,
    })
    .from(facebookPages)
    .where(and(eq(facebookPages.orgId, orgId), eq(facebookPages.pageId, change.page_id)))
    .limit(1);

  if (!page) {
    return { allowed: false, reason: "page_not_connected" };
  }
  if (!page.isActive || !page.isSelected) {
    return { allowed: false, reason: "page_disabled" };
  }
  if (!page.hasToken) {
    return { allowed: false, reason: "page_token_missing" };
  }

  if (!change.form_id?.trim()) {
    return { allowed: true, pageRowId: page.id };
  }

  const [form] = await db
    .select({
      id: facebookForms.id,
      isActive: facebookForms.isActive,
      isSelected: facebookForms.isSelected,
    })
    .from(facebookForms)
    .where(and(eq(facebookForms.orgId, orgId), eq(facebookForms.formId, change.form_id)))
    .limit(1);

  // Unknown form on a known page: allow (new form before next sync) but still ingest.
  if (!form) {
    return { allowed: true, pageRowId: page.id, reason: "form_not_synced_yet" };
  }
  if (!form.isActive || !form.isSelected) {
    return { allowed: false, reason: "form_disabled", pageRowId: page.id, formRowId: form.id };
  }

  return { allowed: true, pageRowId: page.id, formRowId: form.id };
}

/** Status helpers for Settings → Integrations (no env page/form IDs). */
export async function getMetaWebhookScopeSummary(orgId: string = SINGLE_TENANT_ORG_ID) {
  const [pages] = await db
    .select({ value: count() })
    .from(facebookPages)
    .where(
      and(
        eq(facebookPages.orgId, orgId),
        eq(facebookPages.isActive, true),
        eq(facebookPages.isSelected, true),
      ),
    );
  const [forms] = await db
    .select({ value: count() })
    .from(facebookForms)
    .where(
      and(
        eq(facebookForms.orgId, orgId),
        eq(facebookForms.isActive, true),
        eq(facebookForms.isSelected, true),
      ),
    );
  const [subscribed] = await db
    .select({ value: count() })
    .from(facebookPages)
    .where(
      and(
        eq(facebookPages.orgId, orgId),
        eq(facebookPages.isActive, true),
        eq(facebookPages.leadgenSubscribed, true),
      ),
    );

  return {
    activePages: pages?.value ?? 0,
    activeForms: forms?.value ?? 0,
    leadgenSubscribedPages: subscribed?.value ?? 0,
    pageScopingEnabled: true,
    formScopingEnabled: true,
  };
}
