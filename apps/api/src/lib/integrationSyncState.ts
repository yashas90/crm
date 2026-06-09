import { integrationSyncState } from "@propninja/db";
import { eq } from "drizzle-orm";
import { SINGLE_TENANT_ORG_ID } from "./constants.js";
import { db } from "./db.js";

export const GOOGLE_ADS_INTEGRATION = "google_ads";

export async function getIntegrationSyncState(integration: string) {
  const [row] = await db
    .select()
    .from(integrationSyncState)
    .where(eq(integrationSyncState.integration, integration))
    .limit(1);

  return row ?? null;
}

export async function recordIntegrationSyncSuccess(integration: string, syncedAt: Date) {
  const now = new Date();

  await db
    .insert(integrationSyncState)
    .values({
      integration,
      orgId: SINGLE_TENANT_ORG_ID,
      lastSuccessAt: syncedAt,
      lastError: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: integrationSyncState.integration,
      set: {
        lastSuccessAt: syncedAt,
        lastError: null,
        updatedAt: now,
      },
    });
}

export async function recordIntegrationSyncFailure(integration: string, error: string) {
  const now = new Date();

  await db
    .insert(integrationSyncState)
    .values({
      integration,
      orgId: SINGLE_TENANT_ORG_ID,
      lastError: error,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: integrationSyncState.integration,
      set: {
        lastError: error,
        updatedAt: now,
      },
    });
}

/** First run uses lookback; subsequent runs resume from watermark minus overlap. */
export function resolveGoogleAdsSyncSince(
  lastSuccessAt: Date | null | undefined,
  lookbackMinutes: number,
  overlapMinutes: number,
): Date {
  if (lastSuccessAt) {
    return new Date(lastSuccessAt.getTime() - overlapMinutes * 60 * 1000);
  }

  return new Date(Date.now() - lookbackMinutes * 60 * 1000);
}
