"use client";

import { LeadSharedDocumentsPanel } from "@/components/documents/lead-shared-documents-panel";
import { InlineEstimatedValue } from "@/components/leads/inline-estimated-value";
import { LeadActivityTimeline } from "@/components/leads/lead-activity-timeline";
import { LeadAdInfoPanel } from "@/components/leads/lead-ad-info-panel";
import { LeadCallsPanel } from "@/components/leads/lead-calls-panel";
import { ProjectChip, StatusChip, TemperatureChip } from "@/components/leads/lead-chips";
import { LeadDeleteDialog } from "@/components/leads/lead-delete-dialog";
import { LeadEditForm } from "@/components/leads/lead-edit-form";
import { LeadFollowUpPanel } from "@/components/leads/lead-follow-up-panel";
import { LeadOwnershipHistory } from "@/components/leads/lead-ownership-history";
import { LeadScoreBadge, LeadScoreBreakdownTooltip } from "@/components/leads/lead-score-badge";
import { LeadTagsEditor } from "@/components/leads/lead-tags-editor";
import { LeadWhatsAppPanel } from "@/components/leads/lead-whatsapp-panel";
import { LogCallDialog } from "@/components/leads/log-call-dialog";
import { SendWhatsAppTemplateDialog } from "@/components/leads/send-whatsapp-template-dialog";
import { ComplianceChip, TcfConsentPanel } from "@/components/leads/tcf-consent-panel";
import { LeadSiteVisitsPanel } from "@/components/site-visits/lead-site-visits-panel";
import { TasksPanel } from "@/components/tasks/tasks-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAddLeadNote, useCalls, useLead, useLeadAssignments } from "@/hooks/use-leads";
import { usePermissions } from "@/hooks/use-permissions";
import { useTcfConsent } from "@/hooks/use-tcf";
import { useUsers } from "@/hooks/use-users";
import { apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { formatLeadSourceDisplay } from "@/lib/lead-sources";
import { formatDaysAgo, formatRelativeTime, isOverdue } from "@/lib/relative-time";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import {
  CalendarClock,
  Copy,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

function copyText(text: string, label: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }
}

function avatarInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const leadId = id ?? "";
  const { data: lead, isLoading, isError, refetch: refetchLead } = useLead(leadId);
  const { data: assignmentsData, isLoading: assignmentsLoading } = useLeadAssignments(leadId);
  const { data: callsData, refetch: refetchCalls } = useCalls({
    lead_id: leadId,
    page: "1",
    pageSize: "50",
  });
  const { data: tcfData, isLoading: tcfLoading } = useTcfConsent(leadId);
  const { data: users } = useUsers();
  const addNote = useAddLeadNote(leadId);
  const [noteText, setNoteText] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showLogCall, setShowLogCall] = useState(false);
  const [showWhatsAppSend, setShowWhatsAppSend] = useState(false);

  const { ready, canDeleteLead } = usePermissions();
  const callConsent = tcfData?.consents.call?.consented ?? null;

  if (isLoading) {
    return <p className="text-muted-foreground">Loading lead...</p>;
  }

  if (isError || !lead) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Lead not found.</p>
        <Button variant="outline" asChild>
          <Link href="/leads">Back to leads</Link>
        </Button>
      </div>
    );
  }

  const totalCalls = lead.leadSummary?.totalCalls ?? callsData?.total ?? 0;

  function saveNote() {
    if (!noteText.trim()) return;
    addNote.mutate(noteText.trim(), {
      onSuccess: () => {
        setNoteText("");
      },
    });
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href="/leads">← Back to leads</Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAssign((v) => !v)}>
            Assign
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEdit((v) => !v)}>
            Edit
          </Button>
          {ready && canDeleteLead ? (
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                aria-label="More actions"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {menuOpen ? (
                <div className="absolute right-0 z-10 mt-1 min-w-[160px] rounded-lg border border-border bg-card py-1 shadow-md">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowDelete(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete lead
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Hero header */}
      <Card className="overflow-hidden rounded-2xl border-border/60 bg-gradient-to-br from-emerald-500/10 via-card to-indigo-500/10 shadow-md dark:from-emerald-500/15 dark:to-indigo-500/15">
        <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {lead.firstName} {lead.lastName}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={lead.leadStatus} />
              <TemperatureChip temperature={lead.temperature} />
              {typeof lead.score === "number" ? (
                <LeadScoreBreakdownTooltip factors={[]} score={lead.score}>
                  <LeadScoreBadge score={lead.score} showPoints />
                </LeadScoreBreakdownTooltip>
              ) : null}
              {lead.projectName ? <ProjectChip name={lead.projectName} /> : null}
              <ComplianceChip callConsent={callConsent} />
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>Created {formatDaysAgo(lead.createdAt)}</span>
              <span>•</span>
              <span>Last contacted {formatRelativeTime(lead.lastContactedAt)}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1.5">
                Owner:
                {lead.assignedUser ? (
                  <>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                      {avatarInitials(lead.assignedUser.name)}
                    </span>
                    {lead.assignedUser.name}
                  </>
                ) : (
                  <span className="text-foreground/80">Unassigned</span>
                )}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3 lg:justify-end">
            <div className="min-w-[120px] rounded-xl border border-border/60 bg-card/80 px-4 py-3 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md">
              <p className="text-2xl font-bold">{totalCalls}</p>
              <p className="text-xs text-muted-foreground">Total calls</p>
            </div>
            <div className="min-w-[140px] rounded-xl border border-border/60 bg-card/80 px-4 py-3 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md">
              <p className="text-lg font-bold">
                {lead.estimatedValue ? (
                  <>₹{Number(lead.estimatedValue).toLocaleString("en-IN")}</>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">Estimated value</p>
            </div>
            <div
              className={cn(
                "min-w-[160px] rounded-xl border px-4 py-3 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md",
                lead.nextFollowupAt && isOverdue(lead.nextFollowupAt)
                  ? "border-rose-500/40 bg-rose-500/10"
                  : "border-border/60 bg-card/80",
              )}
            >
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                Next follow-up
              </div>
              <p
                className={cn(
                  "mt-1 text-sm font-semibold",
                  lead.nextFollowupAt && isOverdue(lead.nextFollowupAt) && "text-rose-600",
                )}
              >
                {lead.nextFollowupAt
                  ? new Date(lead.nextFollowupAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })
                  : "Not scheduled"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {showEdit ? (
        <Card className="rounded-xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Edit lead</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadEditForm lead={lead} onSuccess={() => setShowEdit(false)} />
          </CardContent>
        </Card>
      ) : null}

      {showAssign ? (
        <Card className="rounded-xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Assign lead</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="assignee">Agent</Label>
            <select
              id="assignee"
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              value={assignUserId}
              onChange={(e) => setAssignUserId(e.target.value)}
            >
              <option value="">Select agent</option>
              {users?.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!assignUserId}
              onClick={() => {
                void apiPost(`/api/leads/${lead.id}/assign`, { user_id: assignUserId }).then(
                  () => {
                    toast.success("Lead assigned");
                    setShowAssign(false);
                  },
                  (err) => toast.error(getErrorMessage(err, "Assign failed")),
                );
              }}
            >
              Save assignment
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left column ~40% */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="rounded-xl border-border/60 shadow-sm transition-all duration-200 hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Contact details</CardTitle>
              {lead.phone ? (
                <Button size="sm" variant="outline" onClick={() => setShowLogCall(true)}>
                  Log a call
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.phone ? (
                <ContactRow
                  icon={Phone}
                  label="Primary phone"
                  value={lead.phone}
                  onCopy={() => copyText(lead.phone!, "Phone")}
                  whatsapp={lead.phone}
                  leadFirstName={lead.firstName}
                />
              ) : null}
              {lead.secondaryPhone ? (
                <ContactRow
                  icon={Phone}
                  label="Secondary phone"
                  value={lead.secondaryPhone}
                  onCopy={() => copyText(lead.secondaryPhone!, "Secondary phone")}
                  whatsapp={lead.secondaryPhone}
                  leadFirstName={lead.firstName}
                />
              ) : null}
              {lead.email ? (
                <ContactRow
                  icon={Mail}
                  label="Email"
                  value={lead.email}
                  onCopy={() => copyText(lead.email!, "Email")}
                />
              ) : null}
              {lead.city || lead.state ? (
                <div className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2 text-sm">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  <span>{[lead.city, lead.state].filter(Boolean).join(", ")}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <LeadAdInfoPanel
            leadSource={lead.leadSource}
            tags={lead.tags}
            customFields={lead.customFields}
          />

          <LeadFollowUpPanel
            leadId={leadId}
            lastContactedAt={lead.lastContactedAt}
            nextFollowupAt={lead.nextFollowupAt ?? null}
            followUpCount={lead.followUpCount ?? 0}
          />

          <Card className="rounded-xl border-border/60 shadow-sm transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Ownership history</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadOwnershipHistory
                assignments={assignmentsData?.items ?? []}
                isLoading={assignmentsLoading}
              />
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/60 shadow-sm transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-base">Lead info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Source</span>
                <span className="font-medium">{formatLeadSourceDisplay(lead.leadSource)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Estimated value</span>
                <div className="mt-1">
                  <InlineEstimatedValue lead={lead} />
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Tags</span>
                <div className="mt-1">
                  <LeadTagsEditor lead={lead} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            id="notes"
            className="rounded-xl border-border/60 shadow-sm transition-all duration-200 hover:shadow-md scroll-mt-24"
          >
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <textarea
                className="min-h-[120px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Add an internal note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <Button size="sm" onClick={saveNote} disabled={addNote.isPending || !noteText.trim()}>
                {addNote.isPending ? "Saving..." : "Save note"}
              </Button>
              {lead.notes ? (
                <div className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">
                  {lead.notes}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Right column ~60% */}
        <div className="lg:col-span-3">
          <Card className="rounded-xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <Tabs defaultValue="timeline">
                <TabsList>
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                  <TabsTrigger value="calls">Calls</TabsTrigger>
                  <TabsTrigger value="site-visits">Site visits</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                  <TabsTrigger value="activity">Activity chart</TabsTrigger>
                  <TabsTrigger value="compliance">Compliance</TabsTrigger>
                </TabsList>
                <TabsContent value="timeline">
                  <LeadActivityTimeline activities={lead.activities} />
                </TabsContent>
                <TabsContent value="tasks" className="pt-4">
                  <TasksPanel leadId={leadId} assignedTo={lead.assignedUser?.id} />
                </TabsContent>
                <TabsContent value="calls">
                  {callsData ? (
                    <LeadCallsPanel calls={callsData.items} mode="table" />
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading calls...</p>
                  )}
                </TabsContent>
                <TabsContent value="site-visits" className="pt-4">
                  <LeadSiteVisitsPanel leadId={leadId} />
                </TabsContent>
                <TabsContent value="documents" className="pt-4">
                  <LeadSharedDocumentsPanel
                    leadId={leadId}
                    leadName={`${lead.firstName} ${lead.lastName}`}
                    leadPhone={lead.phone}
                  />
                </TabsContent>
                <TabsContent value="whatsapp" className="space-y-4 pt-4">
                  <div className="flex justify-end">
                    <Button size="sm" onClick={() => setShowWhatsAppSend(true)}>
                      Send template
                    </Button>
                  </div>
                  <LeadWhatsAppPanel leadId={leadId} />
                </TabsContent>
                <TabsContent value="activity">
                  {callsData ? (
                    <LeadCallsPanel calls={callsData.items} mode="chart" />
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading chart...</p>
                  )}
                </TabsContent>
                <TabsContent value="compliance">
                  <TcfConsentPanel leadId={leadId} data={tcfData} isLoading={tcfLoading} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {ready && canDeleteLead ? (
        <LeadDeleteDialog
          leadId={lead.id}
          leadName={`${lead.firstName} ${lead.lastName}`}
          open={showDelete}
          onOpenChange={setShowDelete}
          redirectOnSuccess
        />
      ) : null}

      {showLogCall ? (
        <LogCallDialog
          lead={lead}
          open={showLogCall}
          onOpenChange={setShowLogCall}
          onLogged={() => {
            void refetchCalls();
            void refetchLead();
          }}
        />
      ) : null}

      <SendWhatsAppTemplateDialog
        lead={lead}
        open={showWhatsAppSend}
        onOpenChange={setShowWhatsAppSend}
      />
    </div>
  );
}

function buildWhatsAppUrl(phone: string, firstName: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized =
    digits.startsWith("91") && digits.length === 12 ? digits : `91${digits.slice(-10)}`;
  const greeting = encodeURIComponent(`Hi ${firstName}`);
  return `https://wa.me/${normalized}?text=${greeting}`;
}

function ContactRow({
  icon: Icon,
  label,
  value,
  onCopy,
  whatsapp,
  leadFirstName,
}: {
  icon: typeof Phone;
  label?: string;
  value: string;
  onCopy: () => void;
  whatsapp?: string;
  leadFirstName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/30 px-3 py-2 text-sm">
      <div className="min-w-0">
        {label ? <p className="text-xs text-muted-foreground">{label}</p> : null}
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{value}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {whatsapp ? (
          <a
            href={buildWhatsAppUrl(whatsapp, leadFirstName ?? "there")}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
            title="Open WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        ) : null}
        <button
          type="button"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onCopy}
          title="Copy"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
