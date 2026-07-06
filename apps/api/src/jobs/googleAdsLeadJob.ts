import { env } from "../lib/env.js";
import {
  type GoogleAdsLeadSubmission,
  fetchLeadFormSubmissions,
  isGoogleAdsConfigured,
} from "../lib/googleAds.js";
import {
  GOOGLE_ADS_INTEGRATION,
  getIntegrationSyncState,
  recordIntegrationSyncFailure,
  recordIntegrationSyncSuccess,
  resolveGoogleAdsSyncSince,
} from "../lib/integrationSyncState.js";
import { logger } from "../lib/logger.js";
import { type NormalizedAdLead, adLeadService } from "../services/adLeadService.js";

function toNormalizedAdLead(submission: GoogleAdsLeadSubmission): NormalizedAdLead {
  return {
    source: "google_ads",
    externalLeadId: submission.externalLeadId,
    campaignId: submission.campaignId,
    campaignName: submission.campaignName,
    adsetId: submission.adsetId,
    adsetName: submission.adsetName,
    formId: submission.formId,
    formName: submission.formName,
    firstName: submission.firstName,
    lastName: submission.lastName,
    fullName: submission.fullName,
    email: submission.email,
    phone: submission.phone,
    city: submission.city,
    rawPayload: submission.rawPayload,
  };
}

export async function syncGoogleAdsLeads() {
  if (!isGoogleAdsConfigured()) {
    logger.warn("Google Ads lead sync skipped: credentials not configured");
    return { ingested: 0, failed: 0, skipped: true };
  }

  const syncStartedAt = new Date();
  const state = await getIntegrationSyncState(GOOGLE_ADS_INTEGRATION);
  const since = resolveGoogleAdsSyncSince(
    state?.lastSuccessAt ?? undefined,
    env.GOOGLE_ADS_LOOKBACK_MINUTES,
    env.GOOGLE_ADS_SYNC_OVERLAP_MINUTES,
  );

  let ingested = 0;
  let failed = 0;

  try {
    const submissions = await fetchLeadFormSubmissions(since);
    logger.info("Google Ads lead sync fetched submissions", {
      count: submissions.length,
      since: since.toISOString(),
      watermark: state?.lastSuccessAt?.toISOString() ?? null,
    });

    for (const submission of submissions) {
      try {
        const lead = await adLeadService.ingestAdLead(toNormalizedAdLead(submission));
        ingested += 1;
        logger.info("Google Ads lead ingested", {
          externalLeadId: submission.externalLeadId,
          leadId: lead.id,
          campaignName: submission.campaignName,
        });
      } catch (error) {
        failed += 1;
        logger.error("Failed to ingest Google Ads lead", {
          externalLeadId: submission.externalLeadId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await recordIntegrationSyncSuccess(GOOGLE_ADS_INTEGRATION, syncStartedAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordIntegrationSyncFailure(GOOGLE_ADS_INTEGRATION, message);
    logger.error("Google Ads lead sync failed", { error: message });
    if (isGoogleAdsAuthFailure(message)) {
      authCircuitOpen = true;
      stopGoogleAdsLeadSync();
      logger.error(
        "Google Ads sync stopped: OAuth refresh token is invalid or expired. " +
          "Set GOOGLE_ADS_SYNC_ENABLED=false or update GOOGLE_ADS_REFRESH_TOKEN, then redeploy.",
      );
    }
    return { ingested, failed, skipped: false, errored: true };
  }

  logger.info("Google Ads lead sync completed", { ingested, failed });
  return { ingested, failed, skipped: false };
}

let syncTimer: ReturnType<typeof setInterval> | undefined;
let authCircuitOpen = false;

function isGoogleAdsAuthFailure(message: string): boolean {
  return message.includes("invalid_grant") || message.includes("invalid_client");
}

export function startGoogleAdsLeadSync() {
  if (!env.GOOGLE_ADS_SYNC_ENABLED || authCircuitOpen) {
    return;
  }

  if (syncTimer) {
    return;
  }

  const intervalMs = env.GOOGLE_ADS_SYNC_INTERVAL_MS;

  logger.info("Starting Google Ads lead sync scheduler", {
    intervalMs,
    lookbackMinutes: env.GOOGLE_ADS_LOOKBACK_MINUTES,
    overlapMinutes: env.GOOGLE_ADS_SYNC_OVERLAP_MINUTES,
  });

  void syncGoogleAdsLeads().catch((error) => {
    logger.error("Initial Google Ads lead sync failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  syncTimer = setInterval(() => {
    void syncGoogleAdsLeads().catch((error) => {
      logger.error("Scheduled Google Ads lead sync failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, intervalMs);

  if (typeof syncTimer === "object" && "unref" in syncTimer) {
    syncTimer.unref();
  }
}

export function stopGoogleAdsLeadSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = undefined;
  }
}

export function resetGoogleAdsAuthCircuit() {
  authCircuitOpen = false;
}
