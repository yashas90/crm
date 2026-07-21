/**
 * Multi-page Lead Ads sync: discover Pages/Forms, store encrypted Page tokens,
 * and subscribe each active selected Page to `leadgen` on the shared app webhook.
 */
import { facebookForms, facebookPages, facebookSyncHistory } from "@propninja/db";
import { and, eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { getLeadForms, getPages, subscribePageToLeadgen } from "../lib/metaGraphClient.js";
import { decryptSecret, encryptSecret } from "../lib/tokenEncryption.js";
import { getActiveAccessToken } from "./metaTokenService.js";

export type PageFormSyncResult = {
  pagesUpserted: number;
  formsUpserted: number;
  subscribed: number;
  subscribeFailed: number;
};

async function startSyncHistory(orgId: string, syncType: string) {
  const [row] = await db
    .insert(facebookSyncHistory)
    .values({ orgId, syncType, status: "running" })
    .returning({ id: facebookSyncHistory.id });
  return row?.id ?? null;
}

async function finishSyncHistory(
  id: string | null,
  status: "success" | "partial" | "failed",
  processed: number,
  failed: number,
  errorMessage?: string,
  metadata?: Record<string, unknown>,
) {
  if (!id) return;
  await db
    .update(facebookSyncHistory)
    .set({
      status,
      finishedAt: new Date(),
      recordsProcessed: processed,
      recordsFailed: failed,
      errorMessage: errorMessage ?? null,
      metadata: metadata ?? {},
    })
    .where(eq(facebookSyncHistory.id, id));
}

/** Upserts Pages (with encrypted page tokens) and Lead Forms for the org. */
export async function syncPagesAndForms(
  orgId: string,
  userAccessToken: string,
): Promise<{ pagesUpserted: number; formsUpserted: number }> {
  const pages = await getPages(userAccessToken);
  let formsUpserted = 0;

  for (const page of pages) {
    const [row] = await db
      .insert(facebookPages)
      .values({
        orgId,
        pageId: page.id,
        name: page.name,
        category: page.category ?? null,
        accessTokenEncrypted: page.access_token ? encryptSecret(page.access_token) : null,
        isActive: true,
        isSelected: true,
      })
      .onConflictDoUpdate({
        target: [facebookPages.orgId, facebookPages.pageId],
        set: {
          name: page.name,
          category: page.category ?? null,
          ...(page.access_token ? { accessTokenEncrypted: encryptSecret(page.access_token) } : {}),
          updatedAt: new Date(),
        },
      })
      .returning({ id: facebookPages.id });

    if (!row) continue;

    const pageToken = page.access_token ?? userAccessToken;
    const forms = await getLeadForms(page.id, pageToken).catch((error) => {
      logger.warn("Failed to list lead forms for page", {
        pageId: page.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    });

    for (const form of forms) {
      await db
        .insert(facebookForms)
        .values({
          orgId,
          pageId: row.id,
          formId: form.id,
          name: form.name,
          status: form.status ?? null,
          locale: form.locale ?? null,
          isActive: true,
          isSelected: true,
        })
        .onConflictDoUpdate({
          target: [facebookForms.orgId, facebookForms.formId],
          set: {
            pageId: row.id,
            name: form.name,
            status: form.status ?? null,
            locale: form.locale ?? null,
            updatedAt: new Date(),
          },
        });
      formsUpserted += 1;
    }
  }

  return { pagesUpserted: pages.length, formsUpserted };
}

/**
 * Subscribes every active + selected Page that has a stored Page token to `leadgen`.
 * Safe to call repeatedly (idempotent on Meta's side).
 */
export async function subscribeSelectedPagesToLeadgen(
  orgId: string = SINGLE_TENANT_ORG_ID,
): Promise<{ subscribed: number; failed: number }> {
  const pages = await db
    .select({
      id: facebookPages.id,
      pageId: facebookPages.pageId,
      accessTokenEncrypted: facebookPages.accessTokenEncrypted,
    })
    .from(facebookPages)
    .where(
      and(
        eq(facebookPages.orgId, orgId),
        eq(facebookPages.isActive, true),
        eq(facebookPages.isSelected, true),
      ),
    );

  let subscribed = 0;
  let failed = 0;

  for (const page of pages) {
    if (!page.accessTokenEncrypted) {
      failed += 1;
      logger.warn("Cannot subscribe page — missing page access token", { pageId: page.pageId });
      continue;
    }

    try {
      const token = decryptSecret(page.accessTokenEncrypted);
      await subscribePageToLeadgen(page.pageId, token);
      await db
        .update(facebookPages)
        .set({ leadgenSubscribed: true, updatedAt: new Date() })
        .where(eq(facebookPages.id, page.id));
      subscribed += 1;
    } catch (error) {
      failed += 1;
      await db
        .update(facebookPages)
        .set({ leadgenSubscribed: false, updatedAt: new Date() })
        .where(eq(facebookPages.id, page.id));
      logger.error("Failed to subscribe page to leadgen", {
        pageId: page.pageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { subscribed, failed };
}

/** Full pages+forms discovery + leadgen subscription (on-demand or scheduled). */
export async function syncPagesFormsAndSubscribe(
  orgId: string = SINGLE_TENANT_ORG_ID,
): Promise<PageFormSyncResult> {
  const historyId = await startSyncHistory(orgId, "pages_forms");
  const accessToken = await getActiveAccessToken(orgId);
  if (!accessToken) {
    await finishSyncHistory(historyId, "failed", 0, 1, "NOT_CONNECTED");
    throw new Error("NOT_CONNECTED");
  }

  try {
    const { pagesUpserted, formsUpserted } = await syncPagesAndForms(orgId, accessToken);
    const { subscribed, failed } = await subscribeSelectedPagesToLeadgen(orgId);
    const status = failed > 0 && subscribed === 0 ? "failed" : failed > 0 ? "partial" : "success";
    await finishSyncHistory(
      historyId,
      status,
      pagesUpserted + formsUpserted + subscribed,
      failed,
      undefined,
      {
        pagesUpserted,
        formsUpserted,
        subscribed,
        subscribeFailed: failed,
      },
    );
    return { pagesUpserted, formsUpserted, subscribed, subscribeFailed: failed };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishSyncHistory(historyId, "failed", 0, 1, message);
    throw error;
  }
}

/** Refresh one Page's token from Graph + re-subscribe leadgen + re-sync forms. */
export async function reconnectPage(
  pageRowId: string,
  orgId: string = SINGLE_TENANT_ORG_ID,
): Promise<{ reconnected: boolean; formsUpserted: number; subscribed: boolean }> {
  const [page] = await db
    .select()
    .from(facebookPages)
    .where(and(eq(facebookPages.id, pageRowId), eq(facebookPages.orgId, orgId)))
    .limit(1);

  if (!page) {
    throw new Error("PAGE_NOT_FOUND");
  }

  const userToken = await getActiveAccessToken(orgId);
  if (!userToken) {
    throw new Error("NOT_CONNECTED");
  }

  const pages = await getPages(userToken);
  const match = pages.find((p) => p.id === page.pageId);
  if (!match?.access_token) {
    throw new Error("PAGE_TOKEN_UNAVAILABLE");
  }

  await db
    .update(facebookPages)
    .set({
      name: match.name,
      category: match.category ?? null,
      accessTokenEncrypted: encryptSecret(match.access_token),
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(facebookPages.id, page.id));

  const forms = await getLeadForms(page.pageId, match.access_token).catch(() => []);
  let formsUpserted = 0;
  for (const form of forms) {
    await db
      .insert(facebookForms)
      .values({
        orgId,
        pageId: page.id,
        formId: form.id,
        name: form.name,
        status: form.status ?? null,
        locale: form.locale ?? null,
      })
      .onConflictDoUpdate({
        target: [facebookForms.orgId, facebookForms.formId],
        set: {
          pageId: page.id,
          name: form.name,
          status: form.status ?? null,
          locale: form.locale ?? null,
          updatedAt: new Date(),
        },
      });
    formsUpserted += 1;
  }

  let subscribed = false;
  try {
    await subscribePageToLeadgen(page.pageId, match.access_token);
    await db
      .update(facebookPages)
      .set({ leadgenSubscribed: true, updatedAt: new Date() })
      .where(eq(facebookPages.id, page.id));
    subscribed = true;
  } catch (error) {
    logger.error("Reconnect page: leadgen subscribe failed", {
      pageId: page.pageId,
      error: error instanceof Error ? error.message : String(error),
    });
    await db
      .update(facebookPages)
      .set({ leadgenSubscribed: false, updatedAt: new Date() })
      .where(eq(facebookPages.id, page.id));
  }

  return { reconnected: true, formsUpserted, subscribed };
}
