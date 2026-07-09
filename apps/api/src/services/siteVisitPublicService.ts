import { leadActivities } from "@propninja/db";
import { getIstDateKey } from "@propninja/types/ist";
import type { PublicSiteVisitView } from "@propninja/types/site-visit-public";
import { SINGLE_TENANT_ORG_ID } from "../lib/constants.js";
import { db } from "../lib/db.js";
import { isValidSiteVisitPublicToken } from "../lib/siteVisitPublicToken.js";
import { SiteVisitOverlapError } from "../lib/siteVisitTime.js";
import { NOTIFICATION_TYPES, createNotificationService } from "./notificationService.js";
import { runSiteVisitAutomation } from "./siteVisitAutomationService.js";
import { siteVisitService } from "./siteVisitService.js";

type VisitRow = NonNullable<Awaited<ReturnType<typeof siteVisitService.getByPublicToken>>>;

function toPublicView(visit: VisitRow): PublicSiteVisitView {
  const isScheduled = visit.status === "scheduled";
  return {
    reference: visit.publicToken,
    status: visit.status,
    projectName: visit.project?.name ?? null,
    unitLabel: visit.unit?.unitNumber ?? null,
    tower: visit.tower,
    visitDate: visit.visitDate,
    visitTime: visit.visitTime,
    duration: visit.duration,
    customerFirstName: visit.lead?.firstName?.trim() || "Guest",
    agentName: visit.agent?.name ?? "Your consultant",
    agentPhone: visit.agent?.phone ?? null,
    mapsLink: visit.mapsLink,
    meetingLocation: visit.meetingLocation,
    propertyLabel: visit.propertyLabel,
    canReschedule: isScheduled,
    canCancel: isScheduled,
    confirmedByClient: visit.confirmedByClient ?? false,
  };
}

async function recordCustomerPortalActivity(
  visit: VisitRow,
  kind: string,
  metadata: Record<string, unknown>,
) {
  await db.insert(leadActivities).values({
    orgId: SINGLE_TENANT_ORG_ID,
    leadId: visit.leadId,
    userId: null,
    type: "site_visit",
    metadata: {
      kind,
      siteVisitId: visit.id,
      source: "customer_portal",
      ...metadata,
    },
  });
}

async function notifyAgent(visit: VisitRow, type: string, payload: Record<string, unknown>) {
  const notifications = createNotificationService(db);
  await notifications.createNotification(visit.agentId, type, payload);
}

function assertScheduled(visit: VisitRow) {
  if (visit.status !== "scheduled") {
    throw new CustomerPortalActionError("ONLY_SCHEDULED", "This visit can no longer be changed.");
  }
}

function assertFutureDate(visitDate: string) {
  const today = getIstDateKey();
  if (visitDate < today) {
    throw new CustomerPortalActionError("PAST_DATE", "Please choose today or a future date.");
  }
}

export class CustomerPortalActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CustomerPortalActionError";
  }
}

export const siteVisitPublicService = {
  toPublicView,

  async getByToken(token: string): Promise<PublicSiteVisitView | null> {
    if (!isValidSiteVisitPublicToken(token)) return null;
    const visit = await siteVisitService.getByPublicToken(token);
    return visit ? toPublicView(visit) : null;
  },

  async reschedule(token: string, input: { visitDate: string; visitTime: string }) {
    if (!isValidSiteVisitPublicToken(token)) return null;
    const existing = await siteVisitService.getByPublicToken(token);
    if (!existing) return null;

    assertScheduled(existing);
    assertFutureDate(input.visitDate);

    try {
      const visit = await siteVisitService.update(existing.id, {
        visitDate: input.visitDate,
        visitTime: input.visitTime,
        status: "scheduled",
      });
      if (!visit) return null;

      await recordCustomerPortalActivity(visit, "customer_reschedule_requested", {
        visitDate: visit.visitDate,
        visitTime: visit.visitTime,
        previousDate: existing.visitDate,
        previousTime: existing.visitTime,
      });

      const leadName = visit.lead
        ? `${visit.lead.firstName} ${visit.lead.lastName}`.trim()
        : "Lead";

      await notifyAgent(visit, NOTIFICATION_TYPES.SITE_VISIT_SCHEDULED, {
        siteVisitId: visit.id,
        leadId: visit.leadId,
        leadName,
        visitDate: visit.visitDate,
        visitTime: visit.visitTime,
        property: visit.propertyLabel ?? visit.propertyAddress ?? "Property",
        scheduledBy: "Customer (self-service)",
        customerReschedule: true,
      });

      void runSiteVisitAutomation(visit.id, "rescheduled", { actorUserId: visit.agentId }).catch(
        () => undefined,
      );

      return toPublicView(visit);
    } catch (error) {
      if (error instanceof SiteVisitOverlapError) {
        throw new CustomerPortalActionError(
          "VISIT_OVERLAP",
          "That time is not available. Please choose another slot.",
        );
      }
      throw error;
    }
  },

  async cancel(token: string) {
    if (!isValidSiteVisitPublicToken(token)) return null;
    const existing = await siteVisitService.getByPublicToken(token);
    if (!existing) return null;

    assertScheduled(existing);

    const visit = await siteVisitService.cancel(existing.id);
    if (!visit) return null;

    await recordCustomerPortalActivity(visit, "visit_cancelled", {
      visitDate: visit.visitDate,
      visitTime: visit.visitTime,
      cancelledBy: "customer",
    });

    const leadName = visit.lead ? `${visit.lead.firstName} ${visit.lead.lastName}`.trim() : "Lead";

    await notifyAgent(visit, NOTIFICATION_TYPES.SITE_VISIT_SCHEDULED, {
      siteVisitId: visit.id,
      leadId: visit.leadId,
      leadName,
      visitDate: visit.visitDate,
      visitTime: visit.visitTime,
      property: visit.propertyLabel ?? visit.propertyAddress ?? "Property",
      scheduledBy: "Customer (cancelled)",
      customerCancelled: true,
    });

    void runSiteVisitAutomation(visit.id, "cancelled", { actorUserId: visit.agentId }).catch(
      () => undefined,
    );

    return toPublicView(visit);
  },

  async confirm(token: string) {
    if (!isValidSiteVisitPublicToken(token)) return null;
    const existing = await siteVisitService.getByPublicToken(token);
    if (!existing) return null;

    assertScheduled(existing);

    const visit = await siteVisitService.update(existing.id, {
      confirmedByClient: true,
      confirmedByClientAt: new Date(),
    });
    if (!visit) return null;

    await recordCustomerPortalActivity(visit, "visit_confirmed_by_client", {
      visitDate: visit.visitDate,
      visitTime: visit.visitTime,
    });

    const leadName = visit.lead ? `${visit.lead.firstName} ${visit.lead.lastName}`.trim() : "Lead";

    await notifyAgent(visit, NOTIFICATION_TYPES.SITE_VISIT_CONFIRMED_BY_CLIENT, {
      siteVisitId: visit.id,
      leadId: visit.leadId,
      leadName,
      visitDate: visit.visitDate,
      visitTime: visit.visitTime,
      property: visit.propertyLabel ?? visit.propertyAddress ?? "Property",
    });

    return toPublicView(visit);
  },

  async requestCallback(token: string) {
    if (!isValidSiteVisitPublicToken(token)) return null;
    const existing = await siteVisitService.getByPublicToken(token);
    if (!existing) return null;

    await recordCustomerPortalActivity(existing, "callback_requested", {
      visitDate: existing.visitDate,
      visitTime: existing.visitTime,
      requestedAt: new Date().toISOString(),
    });

    const leadName = existing.lead
      ? `${existing.lead.firstName} ${existing.lead.lastName}`.trim()
      : "Lead";

    await notifyAgent(existing, NOTIFICATION_TYPES.CALLBACK_REQUESTED, {
      siteVisitId: existing.id,
      leadId: existing.leadId,
      leadName,
      visitDate: existing.visitDate,
      visitTime: existing.visitTime,
      property: existing.propertyLabel ?? existing.propertyAddress ?? "Property",
    });

    return true;
  },
};
