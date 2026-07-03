import { formatVisitTimeDisplay } from "./siteVisitTime.js";

export type SiteVisitMessageContext = {
  customerName: string;
  customerPhone: string | null;
  projectName: string | null;
  unitLabel: string | null;
  tower: string | null;
  visitDate: string;
  visitTime: string;
  mapsLink: string | null;
  meetingLocation: string | null;
  agentName: string;
  agentPhone: string | null;
  duration: number;
};

export type SiteVisitMessageKind =
  | "scheduled"
  | "updated"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "reminder";

function formatDateLabel(visitDate: string) {
  const date = new Date(`${visitDate}T12:00:00`);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeRange(visitTime: string, duration: number) {
  const startLabel = formatVisitTimeDisplay(visitTime);
  const [h, m] = visitTime.split(":").map(Number);
  const end = new Date(2000, 0, 1, h ?? 0, m ?? 0);
  end.setMinutes(end.getMinutes() + duration);
  const endLabel = end.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${startLabel} – ${endLabel}`;
}

function locationLine(ctx: SiteVisitMessageContext) {
  return ctx.mapsLink ?? ctx.meetingLocation ?? "As discussed with your consultant";
}

export function buildCustomerSiteVisitMessage(
  kind: SiteVisitMessageKind,
  ctx: SiteVisitMessageContext,
): string {
  const date = formatDateLabel(ctx.visitDate);
  const time = formatTimeRange(ctx.visitTime, ctx.duration);
  const project = [ctx.projectName, ctx.tower, ctx.unitLabel].filter(Boolean).join(" · ") || "TBC";
  const location = locationLine(ctx);
  const agentPhone = ctx.agentPhone ?? "your consultant";

  if (kind === "cancelled") {
    return [
      "🏡 PropNinja Consulting",
      "",
      `Hi ${ctx.customerName},`,
      "",
      "Your site visit has been cancelled.",
      "",
      `📅 Was scheduled: ${date}`,
      `🕒 Time: ${time}`,
      "",
      "Reply if you would like to reschedule.",
      "",
      "Thank you.",
    ].join("\n");
  }

  if (kind === "completed") {
    return [
      "🏡 PropNinja Consulting",
      "",
      `Hi ${ctx.customerName},`,
      "",
      "Thank you for visiting us today.",
      "",
      `📍 Project: ${project}`,
      "",
      `${ctx.agentName} will follow up with you shortly.`,
      "",
      "Thank you.",
    ].join("\n");
  }

  const action =
    kind === "scheduled"
      ? "scheduled"
      : kind === "reminder"
        ? "coming up"
        : kind === "rescheduled"
          ? "rescheduled"
          : "updated";

  return [
    "🏡 PropNinja Consulting",
    "",
    `Hi ${ctx.customerName},`,
    "",
    `Your Site Visit has been ${action}.`,
    "",
    `📅 Date: ${date}`,
    `🕒 Time: ${time}`,
    "",
    "📍 Project:",
    project,
    "",
    "📌 Location:",
    location,
    "",
    "👨 Sales Consultant:",
    ctx.agentName,
    "",
    "📞 Contact:",
    agentPhone,
    "",
    "Reply if you need to reschedule.",
    "",
    "Thank you.",
  ].join("\n");
}

export function buildAgentSiteVisitMessage(
  kind: SiteVisitMessageKind,
  ctx: SiteVisitMessageContext,
): string {
  const date = formatDateLabel(ctx.visitDate);
  const time = formatTimeRange(ctx.visitTime, ctx.duration);
  const project = [ctx.projectName, ctx.tower, ctx.unitLabel].filter(Boolean).join(" · ") || "TBC";
  const location = locationLine(ctx);

  if (kind === "cancelled") {
    return [
      "Site Visit Cancelled",
      "",
      `Customer: ${ctx.customerName}`,
      `Project: ${project}`,
      `Was: ${date} at ${time}`,
      `Phone: ${ctx.customerPhone ?? "—"}`,
    ].join("\n");
  }

  const heading =
    kind === "reminder"
      ? "Site Visit Reminder"
      : kind === "completed"
        ? "Site Visit Completed"
        : kind === "updated" || kind === "rescheduled"
          ? "Site Visit Updated"
          : "New Site Visit Assigned";

  return [
    heading,
    "",
    `Customer: ${ctx.customerName}`,
    `Project: ${project}`,
    `Date: ${date}`,
    `Time: ${time}`,
    `Phone: ${ctx.customerPhone ?? "—"}`,
    `Location: ${location}`,
  ].join("\n");
}
