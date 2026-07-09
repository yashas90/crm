"use client";

import {
  AddToCalendarDropdown,
  siteVisitToCalendarEvent,
} from "@/components/site-visits/add-to-calendar-dropdown";
import {
  cancelPublicSiteVisit,
  confirmPublicSiteVisit,
  requestCallbackPublicSiteVisit,
  reschedulePublicSiteVisit,
} from "@/lib/public-site-visit-api";
import {
  type SiteVisitCalendarEvent,
  buildGoogleCalendarUrl,
  downloadSiteVisitIcs,
} from "@/lib/site-visit-calendar";
import { toast } from "@/lib/toast";
import { formatVisitTimeIst } from "@propninja/types/ist";
import { buildWhatsAppUrl } from "@propninja/types/message-templates";
import type { PublicSiteVisitView } from "@propninja/types/site-visit-public";
import { buildCustomerToAgentWhatsAppMessage } from "@propninja/types/site-visit-public";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import {
  CalendarPlus,
  CheckCircle,
  Download,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

type PublicSiteVisitClientProps = {
  token: string;
  initial: PublicSiteVisitView;
};

function statusLabel(status: PublicSiteVisitView["status"]) {
  switch (status) {
    case "scheduled":
      return "Confirmed";
    case "cancelled":
      return "Cancelled";
    case "completed":
      return "Completed";
    case "no_show":
      return "Missed";
    default:
      return status;
  }
}

function toCalendarEvent(visit: PublicSiteVisitView): SiteVisitCalendarEvent {
  return {
    id: visit.reference,
    leadName: visit.customerFirstName,
    projectName: visit.projectName,
    visitDate: visit.visitDate,
    visitTime: visit.visitTime,
    duration: visit.duration,
    propertyAddress: visit.meetingLocation ?? visit.propertyLabel,
  };
}

function formatVisitDate(visitDate: string) {
  const date = new Date(`${visitDate}T12:00:00`);
  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PublicSiteVisitClient({ token, initial }: PublicSiteVisitClientProps) {
  const [visit, setVisit] = useState(initial);
  const [view, setView] = useState<"main" | "reschedule" | "cancel">("main");
  const [rescheduleDate, setRescheduleDate] = useState(visit.visitDate);
  const [rescheduleTime, setRescheduleTime] = useState(visit.visitTime.slice(0, 5));
  const [busy, setBusy] = useState(false);
  const [callbackSent, setCallbackSent] = useState(false);

  const calendarEvent = useMemo(() => toCalendarEvent(visit), [visit]);

  const projectLine = [visit.projectName, visit.tower, visit.unitLabel].filter(Boolean).join(" · ");

  const mapsUrl =
    visit.mapsLink ??
    (visit.meetingLocation
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visit.meetingLocation)}`
      : null);

  const whatsappUrl = useMemo(() => {
    if (!visit.agentPhone) return null;
    const message = buildCustomerToAgentWhatsAppMessage({
      customerName: visit.customerFirstName,
      customerPhone: null,
      projectName: visit.projectName,
      unitLabel: visit.unitLabel,
      tower: visit.tower,
      visitDate: visit.visitDate,
      visitTime: visit.visitTime,
      mapsLink: visit.mapsLink,
      meetingLocation: visit.meetingLocation,
      agentName: visit.agentName,
      agentPhone: visit.agentPhone,
      duration: visit.duration,
    });
    return buildWhatsAppUrl(visit.agentPhone, message);
  }, [visit]);

  async function handleReschedule() {
    setBusy(true);
    const result = await reschedulePublicSiteVisit(token, {
      visitDate: rescheduleDate,
      visitTime: rescheduleTime,
    });
    setBusy(false);
    if (!result.data) {
      toast.error(result.error ?? "Could not reschedule. Try another time.");
      return;
    }
    setVisit(result.data);
    setView("main");
    toast.success("Visit rescheduled.");
  }

  async function handleCancel() {
    setBusy(true);
    const result = await cancelPublicSiteVisit(token);
    setBusy(false);
    if (!result.data) {
      toast.error(result.error ?? "Could not cancel visit.");
      return;
    }
    setVisit(result.data);
    setView("main");
    toast.success("Visit cancelled.");
  }

  async function handleConfirm() {
    setBusy(true);
    const result = await confirmPublicSiteVisit(token);
    setBusy(false);
    if (!result.data) {
      toast.error(result.error ?? "Could not confirm visit.");
      return;
    }
    setVisit(result.data);
    toast.success("Visit confirmed! We'll see you there.");
  }

  async function handleCallbackRequest() {
    setBusy(true);
    const result = await requestCallbackPublicSiteVisit(token);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not send request.");
      return;
    }
    setCallbackSent(true);
    toast.success("Callback requested! Your agent will be in touch soon.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="mb-6 text-center">
            <p className="text-3xl" aria-hidden>
              🏡
            </p>
            <h1 className="mt-2 text-xl font-bold tracking-tight">Site Visit Confirmation</h1>
            <p className="mt-1 text-sm text-muted-foreground">{visit.reference}</p>
            <span
              className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                visit.status === "scheduled"
                  ? "bg-emerald-100 text-emerald-800"
                  : visit.status === "cancelled"
                    ? "bg-red-100 text-red-800"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              {statusLabel(visit.status)}
            </span>
          </div>

          {view === "main" ? (
            <div className="space-y-5">
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Project:</span> {projectLine || "TBC"}
                </p>
                <p>
                  <span className="font-medium">Date:</span> {formatVisitDate(visit.visitDate)}
                </p>
                <p>
                  <span className="font-medium">Time:</span> {formatVisitTimeIst(visit.visitTime)}
                  {visit.duration ? ` (${visit.duration} min)` : ""}
                </p>
                <p>
                  <span className="font-medium">Sales Consultant:</span> {visit.agentName}
                </p>
                {visit.propertyLabel ? (
                  <p>
                    <span className="font-medium">Location:</span> {visit.propertyLabel}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                {visit.canReschedule && !visit.confirmedByClient ? (
                  <Button
                    className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={busy}
                    onClick={() => void handleConfirm()}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Yes, I'll be there!
                  </Button>
                ) : null}

                {visit.confirmedByClient ? (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <CheckCircle className="h-4 w-4" />
                    You've confirmed this visit
                  </div>
                ) : null}

                {mapsUrl ? (
                  <Button variant="outline" className="w-full justify-start gap-2" asChild>
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                      <MapPin className="h-4 w-4" />
                      Open Google Maps
                    </a>
                  </Button>
                ) : null}

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => window.open(buildGoogleCalendarUrl(calendarEvent), "_blank")}
                >
                  <CalendarPlus className="h-4 w-4" />
                  Add to Google Calendar
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => downloadSiteVisitIcs(calendarEvent)}
                >
                  <Download className="h-4 w-4" />
                  Download .ics file
                </Button>

                {visit.canReschedule ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      setRescheduleDate(visit.visitDate);
                      setRescheduleTime(visit.visitTime.slice(0, 5));
                      setView("reschedule");
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Reschedule visit
                  </Button>
                ) : null}

                {visit.canCancel ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                    onClick={() => setView("cancel")}
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel visit
                  </Button>
                ) : null}

                {visit.agentPhone ? (
                  <Button variant="outline" className="w-full justify-start gap-2" asChild>
                    <a href={`tel:${visit.agentPhone}`}>
                      <Phone className="h-4 w-4" />
                      Call agent
                    </a>
                  </Button>
                ) : null}

                {whatsappUrl ? (
                  <Button className="w-full justify-start gap-2" asChild>
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4" />
                      Chat on WhatsApp
                    </a>
                  </Button>
                ) : null}

                {visit.canReschedule ? (
                  callbackSent ? (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      <PhoneCall className="h-4 w-4" />
                      Callback requested — we'll be in touch!
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      disabled={busy}
                      onClick={() => void handleCallbackRequest()}
                    >
                      <PhoneCall className="h-4 w-4" />
                      Request a callback
                    </Button>
                  )
                ) : null}
              </div>
            </div>
          ) : null}

          {view === "reschedule" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Reschedule visit</h2>
              <p className="text-sm text-muted-foreground">
                Pick a new date and time. We will confirm with {visit.agentName}.
              </p>
              <div className="space-y-2">
                <Label htmlFor="reschedule-date">Date</Label>
                <Input
                  id="reschedule-date"
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reschedule-time">Time</Label>
                <Input
                  id="reschedule-time"
                  type="time"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={busy || !rescheduleDate || !rescheduleTime}
                  onClick={() => void handleReschedule()}
                >
                  Confirm new time
                </Button>
                <Button variant="outline" onClick={() => setView("main")}>
                  Back
                </Button>
              </div>
            </div>
          ) : null}

          {view === "cancel" ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Cancel visit?</h2>
              <p className="text-sm text-muted-foreground">
                Your appointment on {formatVisitDate(visit.visitDate)} at{" "}
                {formatVisitTimeIst(visit.visitTime)} will be cancelled. {visit.agentName} will be
                notified.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => void handleCancel()}
                >
                  Yes, cancel visit
                </Button>
                <Button variant="outline" onClick={() => setView("main")}>
                  Keep visit
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by PropNinja CRM · Ref {visit.reference}
        </p>
      </div>
    </div>
  );
}
