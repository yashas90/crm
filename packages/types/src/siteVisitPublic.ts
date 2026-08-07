import { formatVisitTimeIst } from "./ist.js";
import type { SiteVisitMessageContext } from "./siteVisitMessages.js";

export type PublicSiteVisitGalleryImage = {
  id: string;
  url: string;
  name: string;
};

export type PublicSiteVisitBrochure = {
  id: string;
  url: string;
  name: string;
  type: "brochure" | "floor_plan" | "other";
};

export type PublicSiteVisitView = {
  reference: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  projectName: string | null;
  unitLabel: string | null;
  tower: string | null;
  visitDate: string;
  visitTime: string;
  duration: number;
  customerFirstName: string;
  agentName: string;
  agentPhone: string | null;
  mapsLink: string | null;
  meetingLocation: string | null;
  propertyLabel: string | null;
  canReschedule: boolean;
  canCancel: boolean;
  confirmedByClient: boolean;
  galleryImages: PublicSiteVisitGalleryImage[];
  brochures: PublicSiteVisitBrochure[];
};

/** Customer-facing page URL on the web app. */
export function buildSiteVisitCustomerUrl(
  publicToken: string,
  webBaseUrl = "https://www.ninjamarketing.in",
): string {
  const base = webBaseUrl.replace(/\/$/, "");
  return `${base}/sitevisit/${encodeURIComponent(publicToken)}`;
}

function formatDateLabel(visitDate: string) {
  const date = new Date(`${visitDate}T12:00:00`);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Pre-filled message when the customer opens WhatsApp to contact their agent. */
export function buildCustomerToAgentWhatsAppMessage(ctx: SiteVisitMessageContext): string {
  const date = formatDateLabel(ctx.visitDate);
  const time = formatVisitTimeIst(ctx.visitTime);
  const project = [ctx.projectName, ctx.tower, ctx.unitLabel].filter(Boolean).join(" · ") || "TBC";

  return [
    `Hi ${ctx.agentName},`,
    "",
    `I have a site visit scheduled for ${date} at ${time}.`,
    `Project: ${project}`,
    "",
    "Please let me know if you need anything from me.",
  ].join("\n");
}
