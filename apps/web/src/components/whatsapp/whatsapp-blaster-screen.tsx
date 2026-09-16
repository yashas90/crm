"use client";

import { Badge } from "@/components/ui/badge";
import { useProjects } from "@/hooks/use-projects";
import { useUsersList } from "@/hooks/use-users";
import {
  type BlastCampaign,
  downloadCampaignExport,
  fileToBase64,
  useBlastCampaign,
  useBlastTemplates,
  useCampaignAction,
  useCreateBlastCampaign,
  useParseBlastContacts,
  useReplaceBlastContacts,
  useSaveBlastTemplate,
  useUpdateBlastCampaign,
  useWhatsAppProvider,
} from "@/hooks/use-whatsapp-blaster";
import {
  DEFAULT_BLAST_MESSAGE_BODY,
  DEFAULT_WHATSAPP_BUTTONS,
  DEFAULT_WHATSAPP_QUESTION_FLOW,
  type ParsedWhatsAppContact,
  type WhatsAppColumnMapping,
  type WhatsAppQuestionFlow,
  type WhatsAppTemplateButton,
  guessWhatsAppColumn,
  renderWhatsAppTemplate,
} from "@propninja/types/whatsapp-blaster";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@propninja/ui/card";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useEffect, useState } from "react";

const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5";

function downloadInvalidCsv(contacts: ParsedWhatsAppContact[]) {
  const rows = contacts.filter((c) => !c.valid);
  const csv = [
    "row,name,phone,city,budget,reason",
    ...rows.map(
      (c) =>
        `${c.row},"${c.name.replaceAll('"', '""')}",${c.phone},${c.city},${c.budget},"${(c.invalidReason ?? "").replaceAll('"', '""')}"`,
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "invalid-whatsapp-numbers.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function WhatsAppBlasterScreen() {
  const provider = useWhatsAppProvider();
  const templates = useBlastTemplates();
  const projects = useProjects();
  const users = useUsersList({ page: 1, pageSize: 100 });
  const createCampaign = useCreateBlastCampaign();
  const saveTemplate = useSaveBlastTemplate();
  const parseContacts = useParseBlastContacts();

  const [campaignId, setCampaignId] = useState<string | null>(null);
  const campaignQuery = useBlastCampaign(campaignId);
  const campaign = campaignQuery.data;
  const updateCampaign = useUpdateBlastCampaign(campaignId ?? "");
  const replaceContacts = useReplaceBlastContacts(campaignId ?? "");
  const action = useCampaignAction(campaignId ?? "");

  const [campaignName, setCampaignName] = useState("");
  const [templateName, setTemplateName] = useState("Property blast");
  const [body, setBody] = useState(DEFAULT_BLAST_MESSAGE_BODY);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "pdf" | "video" | "">("");
  const [buttons, setButtons] = useState<WhatsAppTemplateButton[]>(DEFAULT_WHATSAPP_BUTTONS);
  const [flow, setFlow] = useState<WhatsAppQuestionFlow>(DEFAULT_WHATSAPP_QUESTION_FLOW);
  const [propertyId, setPropertyId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [speed, setSpeed] = useState<"safe" | "normal" | "fast">("safe");
  const [dailyLimit, setDailyLimit] = useState(500);
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [parsed, setParsed] = useState<{
    headers: string[];
    contacts: ParsedWhatsAppContact[];
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  } | null>(null);
  const [mapping, setMapping] = useState<WhatsAppColumnMapping>({ phone: "" });

  useEffect(() => {
    if (!campaign) return;
    setCampaignName(campaign.name);
    setPropertyId(campaign.propertyId ?? "");
    setAgentId(campaign.assignedAgentId ?? "");
    setSpeed(campaign.sendingSpeed);
    setDailyLimit(campaign.dailyLimit);
    if (campaign.template) {
      setTemplateName(campaign.template.name);
      setBody(campaign.template.body);
      setMediaUrl(campaign.template.mediaUrl ?? "");
      setMediaType(campaign.template.mediaType ?? "");
      setButtons(campaign.template.buttons);
      setFlow(campaign.template.questionFlow);
    }
  }, [campaign]);

  const propertyName =
    projects.data?.find((p) => p.id === propertyId)?.name ??
    campaign?.propertyName ??
    "Sunrise Heights";

  const preview = renderWhatsAppTemplate(body, {
    name: parsed?.contacts.find((c) => c.valid)?.name ?? "Priya",
    city: parsed?.contacts.find((c) => c.valid)?.city ?? "Whitefield",
    budget: parsed?.contacts.find((c) => c.valid)?.budget ?? "₹80L",
    property_name: propertyName,
  });

  async function onUpload(file: File) {
    const isCsv = /\.csv$/i.test(file.name) || file.type.includes("csv");
    if (isCsv) {
      const text = await file.text();
      const result = await parseContacts.mutateAsync({ csvText: text });
      applyParse(result);
      return;
    }
    const fileBase64 = await fileToBase64(file);
    const result = await parseContacts.mutateAsync({ fileBase64, fileName: file.name });
    applyParse(result);
  }

  function applyParse(result: {
    headers: string[];
    contacts: ParsedWhatsAppContact[];
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
    mapping?: WhatsAppColumnMapping;
  }) {
    const nextMapping: WhatsAppColumnMapping = {
      phone:
        result.mapping?.phone ||
        guessWhatsAppColumn(result.headers, "phone") ||
        result.headers[0] ||
        "",
      name: result.mapping?.name || guessWhatsAppColumn(result.headers, "name"),
      city: result.mapping?.city || guessWhatsAppColumn(result.headers, "city"),
      budget: result.mapping?.budget || guessWhatsAppColumn(result.headers, "budget"),
    };
    setMapping(nextMapping);
    setParsed(result);
  }

  async function remap(next: WhatsAppColumnMapping) {
    setMapping(next);
    if (!parsed) return;
    const csv = [
      parsed.headers.join(","),
      ...parsed.contacts.map((c) =>
        parsed.headers
          .map((h) => {
            if (h === mapping.phone || h === next.phone) return c.phone;
            if (h === mapping.name || h === next.name) return c.name;
            if (h === mapping.city || h === next.city) return c.city;
            if (h === mapping.budget || h === next.budget) return c.budget;
            return "";
          })
          .join(","),
      ),
    ].join("\n");
    const result = await parseContacts.mutateAsync({ csvText: csv, mapping: next });
    setParsed(result);
  }

  async function persistTemplate() {
    const saved = await saveTemplate.mutateAsync({
      id: campaign?.templateId ?? undefined,
      name: templateName,
      body,
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || null,
      buttons,
      questionFlow: flow,
      thankYouMessage: flow.thankYouMessage,
    });
    return saved;
  }

  async function persistCampaign() {
    const template = await persistTemplate();
    const payload = {
      name: campaignName || "WhatsApp campaign",
      propertyId: propertyId || null,
      templateId: template.id,
      assignedAgentId: agentId || null,
      sendingSpeed: speed,
      dailyLimit,
      scheduledAt:
        scheduleMode === "later" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
    };
    if (!campaignId) {
      const created = await createCampaign.mutateAsync(payload);
      setCampaignId(created.id);
      if (parsed) {
        await useReplace(created.id, parsed.contacts);
      }
      return created;
    }
    await updateCampaign.mutateAsync(payload);
    if (parsed) await replaceContacts.mutateAsync({ contacts: parsed.contacts });
    return campaign;
  }

  async function useReplace(id: string, contacts: ParsedWhatsAppContact[]) {
    await fetchReplace(id, contacts);
  }

  async function fetchReplace(id: string, contacts: ParsedWhatsAppContact[]) {
    const { apiPost } = await import("@/lib/apiClient");
    await apiPost(`/api/whatsapp/blaster/campaigns/${id}/contacts`, { contacts });
  }

  async function launch() {
    const saved = await persistCampaign();
    const id = campaignId ?? (saved as BlastCampaign).id;
    if (!id) return;
    if (parsed) await fetchReplace(id, parsed.contacts);
    if (scheduleMode === "later") return;
    await action.mutateAsync("start");
    setCampaignId(id);
  }

  const stats = campaign;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Provider: {provider.data?.label ?? "Checking…"}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">A — Contact upload</CardTitle>
          <CardDescription>
            CSV or Excel (.xlsx). Phone numbers are formatted to +91XXXXXXXXXX.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept=".csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
            }}
          />
          {parsed ? (
            <>
              <p className="text-sm font-medium">{parsed.total} contacts loaded</p>
              <p className="text-sm">
                {parsed.valid} valid | {parsed.invalid} invalid | {parsed.duplicates} duplicates
              </p>
              <div className="grid gap-3 sm:grid-cols-4">
                {(["name", "phone", "city", "budget"] as const).map((key) => (
                  <label key={key} className="text-xs font-medium text-slate-500">
                    {key === "phone" ? "Which column is the phone number?" : `Column: ${key}`}
                    <select
                      className={`${fieldClass} mt-1`}
                      value={mapping[key] ?? ""}
                      onChange={(e) => void remap({ ...mapping, [key]: e.target.value })}
                    >
                      <option value="">—</option>
                      {parsed.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200/80 dark:border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Phone</th>
                      <th className="px-3 py-2">City</th>
                      <th className="px-3 py-2">Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.contacts.slice(0, 50).map((row) => (
                      <tr key={`${row.row}-${row.phone}`} className="border-t">
                        <td className="px-3 py-2">{row.name}</td>
                        <td className={`px-3 py-2 ${row.valid ? "" : "text-red-600"}`}>
                          {row.formattedPhone ?? row.phone}
                        </td>
                        <td className="px-3 py-2">{row.city}</td>
                        <td className="px-3 py-2">{row.budget}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadInvalidCsv(parsed.contacts)}
              >
                Download invalid numbers
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">B — Message template builder</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <Label>Template name</Label>
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
            <Label>Message body</Label>
            <textarea
              className={`${fieldClass} min-h-40`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Variables: {"{{name}}"} {"{{city}}"} {"{{budget}}"} {"{{property_name}}"} —{" "}
              {body.length} / 4096
            </p>
            <Label>Media URL (image / PDF / video)</Label>
            <Input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://…"
            />
            <select
              className={fieldClass}
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as typeof mediaType)}
            >
              <option value="">No media</option>
              <option value="image">Image (property photo)</option>
              <option value="pdf">PDF (brochure)</option>
              <option value="video">Video (walkthrough)</option>
            </select>
            {buttons.map((button, index) => (
              <div key={button.id} className="grid grid-cols-2 gap-2">
                <Input
                  value={button.label}
                  onChange={(e) => {
                    const next = [...buttons];
                    next[index] = { ...button, label: e.target.value };
                    setButtons(next);
                  }}
                />
                <p className="self-center text-xs text-muted-foreground">{button.action}</p>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => void persistTemplate()}>
              Save template for reuse
            </Button>
          </div>
          <div className="mx-auto w-72 rounded-[2rem] border-8 border-slate-900 bg-slate-900 p-3 shadow-xl">
            <div className="rounded-2xl bg-[#ece5dd] p-3 min-h-[420px]">
              <p className="mb-2 text-center text-[10px] font-semibold text-slate-500">
                WhatsApp preview
              </p>
              <div className="ml-auto max-w-[85%] rounded-lg bg-[#dcf8c6] p-2 text-xs whitespace-pre-wrap text-slate-800">
                {preview}
              </div>
              <div className="mt-3 space-y-1">
                {buttons.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-md border border-emerald-700/30 bg-white py-1 text-center text-[11px] text-emerald-800"
                  >
                    {b.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">C — Automated question flow</CardTitle>
          <CardDescription>
            Sent automatically after the customer taps I&apos;m Interested. No agent input needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {flow.questions.map((question, qIndex) => (
            <div
              key={question.id}
              className="rounded-xl border border-slate-200/80 p-4 dark:border-white/10"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Question {qIndex + 1}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setFlow({
                      ...flow,
                      questions: flow.questions.filter((q) => q.id !== question.id),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
              <Input
                value={question.text}
                onChange={(e) => {
                  const questions = flow.questions.map((q) =>
                    q.id === question.id ? { ...q, text: e.target.value } : q,
                  );
                  setFlow({ ...flow, questions });
                }}
              />
              <div className="mt-3 space-y-2">
                {question.options.map((opt, oIndex) => (
                  <div key={opt.id} className="grid gap-2 sm:grid-cols-3">
                    <Input
                      value={opt.label}
                      onChange={(e) => {
                        const questions = flow.questions.map((q) =>
                          q.id === question.id
                            ? {
                                ...q,
                                options: q.options.map((o, i) =>
                                  i === oIndex ? { ...o, label: e.target.value } : o,
                                ),
                              }
                            : q,
                        );
                        setFlow({ ...flow, questions });
                      }}
                    />
                    <select
                      className={fieldClass}
                      value={opt.nextQuestionId ?? ""}
                      onChange={(e) => {
                        const questions = flow.questions.map((q) =>
                          q.id === question.id
                            ? {
                                ...q,
                                options: q.options.map((o, i) =>
                                  i === oIndex
                                    ? { ...o, nextQuestionId: e.target.value || null }
                                    : o,
                                ),
                              }
                            : q,
                        );
                        setFlow({ ...flow, questions });
                      }}
                    >
                      <option value="">End flow (thank you)</option>
                      {flow.questions
                        .filter((q) => q.id !== question.id)
                        .map((q) => (
                          <option key={q.id} value={q.id}>
                            Next: {q.text.slice(0, 40)}
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const questions = flow.questions.map((q) =>
                          q.id === question.id
                            ? { ...q, options: q.options.filter((_, i) => i !== oIndex) }
                            : q,
                        );
                        setFlow({ ...flow, questions });
                      }}
                    >
                      Remove option
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const questions = flow.questions.map((q) =>
                      q.id === question.id
                        ? {
                            ...q,
                            options: [
                              ...q.options,
                              {
                                id: `opt_${Date.now()}`,
                                label: "New option",
                                nextQuestionId: null,
                              },
                            ],
                          }
                        : q,
                    );
                    setFlow({ ...flow, questions });
                  }}
                >
                  Add option
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setFlow({
                ...flow,
                questions: [
                  ...flow.questions,
                  {
                    id: `q_${Date.now()}`,
                    text: "New question",
                    options: [{ id: `opt_${Date.now()}`, label: "Option 1", nextQuestionId: null }],
                  },
                ],
              })
            }
          >
            Add qualification question
          </Button>
          <Label>Thank you message</Label>
          <textarea
            className={`${fieldClass} min-h-20`}
            value={flow.thankYouMessage}
            onChange={(e) => setFlow({ ...flow, thankYouMessage: e.target.value })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">D — Campaign settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Campaign name</Label>
            <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
          </div>
          <div>
            <Label>Property / project</Label>
            <select
              className={fieldClass}
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              <option value="">Select project</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Assign to agent</Label>
            <select
              className={fieldClass}
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {(users.data?.items ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Sending speed</Label>
            <select
              className={fieldClass}
              value={speed}
              onChange={(e) => setSpeed(e.target.value as typeof speed)}
            >
              <option value="safe">Safe — 1 msg / 3 sec (recommended)</option>
              <option value="normal">Normal — 1 msg / sec</option>
              <option value="fast">Fast — bulk (risk of WhatsApp ban)</option>
            </select>
            {speed === "fast" ? (
              <p className="mt-1 text-xs text-red-600">
                Fast sending can get the business number banned. Use only if you accept that risk.
              </p>
            ) : null}
          </div>
          <div>
            <Label>Daily limit</Label>
            <Input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value) || 500)}
            />
          </div>
          <div>
            <Label>Schedule</Label>
            <select
              className={fieldClass}
              value={scheduleMode}
              onChange={(e) => setScheduleMode(e.target.value as typeof scheduleMode)}
            >
              <option value="now">Send now</option>
              <option value="later">Schedule for later</option>
            </select>
            {scheduleMode === "later" ? (
              <Input
                className="mt-2"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">E — Launch & monitor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void launch()} disabled={action.isPending}>
              Start campaign
            </Button>
            <Button type="button" variant="outline" onClick={() => void persistCampaign()}>
              Save draft
            </Button>
            {campaign?.status === "running" ? (
              <Button type="button" variant="outline" onClick={() => action.mutate("pause")}>
                Pause
              </Button>
            ) : null}
            {campaign?.status === "paused" ? (
              <Button type="button" variant="outline" onClick={() => action.mutate("resume")}>
                Resume
              </Button>
            ) : null}
            {campaign && campaign.status !== "completed" ? (
              <Button type="button" variant="outline" onClick={() => action.mutate("stop")}>
                Stop
              </Button>
            ) : null}
            {campaignId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void downloadCampaignExport(
                    campaignId,
                    `${campaign?.campaignCode ?? "campaign"}.csv`,
                  )
                }
              >
                Export report CSV
              </Button>
            ) : null}
          </div>
          {stats ? (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${stats.totalContacts ? Math.min(100, (stats.sentCount / stats.totalContacts) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-sm">
                Sending... {stats.sentCount}/{stats.totalContacts || parsed?.valid || 0}
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Stat label="✅ Sent" value={stats.sentCount} />
                <Stat label="❌ Failed" value={stats.failedCount} />
                <Stat label="👁️ Delivered" value={stats.deliveredCount} />
                <Stat label="📖 Read" value={stats.readCount} />
                <Stat label="💬 Replied" value={stats.repliedCount} />
                <Stat label="✅ Interested" value={stats.interestedCount} />
                <Stat label="❌ Not Interested" value={stats.notInterestedCount} />
                <Stat label="Leads" value={stats.leadsGenerated} />
              </div>
              <Badge>{stats.status}</Badge>
            </>
          ) : null}
        </CardContent>
      </Card>

      {(templates.data?.items.length ?? 0) > 0 ? (
        <p className="text-xs text-muted-foreground">
          Saved templates: {templates.data?.items.map((t) => t.name).join(", ")}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200/80 px-3 py-2 dark:border-white/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
