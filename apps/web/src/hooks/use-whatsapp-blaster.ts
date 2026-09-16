"use client";

import { apiDownload, apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import type {
  ParsedWhatsAppContactList,
  WhatsAppColumnMapping,
  WhatsAppMediaType,
  WhatsAppProviderInfo,
  WhatsAppQuestionFlow,
  WhatsAppSendingSpeed,
  WhatsAppTemplateButton,
} from "@propninja/types/whatsapp-blaster";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type BlastTemplate = {
  id: string;
  name: string;
  body: string;
  mediaUrl: string | null;
  mediaType: WhatsAppMediaType | null;
  buttons: WhatsAppTemplateButton[];
  questionFlow: WhatsAppQuestionFlow;
  thankYouMessage: string | null;
  createdAt: string | null;
};

export type BlastCampaign = {
  id: string;
  campaignCode: string;
  campaignId: string;
  name: string;
  propertyId: string | null;
  propertyName: string | null;
  templateId: string | null;
  status: "draft" | "scheduled" | "running" | "paused" | "completed";
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  assignedAgentId: string | null;
  sendingSpeed: WhatsAppSendingSpeed;
  dailyLimit: number;
  sentToday: number;
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  interestedCount: number;
  notInterestedCount: number;
  leadsGenerated: number;
  createdAt: string | null;
  template?: BlastTemplate | null;
  assignedAgent?: { id: string; name: string } | null;
  provider?: WhatsAppProviderInfo;
};

export type BlastContact = {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  budget: string | null;
  status: string;
  isValid: boolean;
  invalidReason: string | null;
  interestClickedAt: string | null;
  questionAnswers: Record<string, unknown>;
  unreadCount: number;
  campaignName?: string;
  campaignCode?: string;
  assignedAgentId?: string | null;
  lastInboundAt?: string | null;
};

export type BlastMessage = {
  id: string;
  direction: "outbound" | "inbound";
  type: string;
  content: string;
  status: string;
  timestamp: string | null;
};

export type WhatsAppLeadRow = {
  id: string;
  leadCode: string;
  leadId: string;
  name: string;
  contactPhone: string;
  budgetAnswer: string | null;
  locationAnswer: string | null;
  timelineAnswer: string | null;
  allAnswers: Record<string, unknown>;
  sourceCampaign: string | null;
  propertyName: string | null;
  assignedAgentId: string | null;
  assignedAgentName?: string | null;
  status: string;
  convertedToLeadId: string | null;
  interestAt: string | null;
  transcript?: BlastMessage[];
};

const KEY = ["whatsapp-blaster"] as const;

export function useWhatsAppProvider() {
  return useQuery({
    queryKey: [...KEY, "provider"],
    queryFn: () => apiGet<WhatsAppProviderInfo>("/api/whatsapp/blaster/provider"),
  });
}

export function useWhatsAppUnreadCount() {
  return useQuery({
    queryKey: [...KEY, "unread"],
    queryFn: () => apiGet<{ count: number }>("/api/whatsapp/blaster/unread-count"),
    refetchInterval: 5_000,
  });
}

export function useBlastTemplates() {
  return useQuery({
    queryKey: [...KEY, "templates"],
    queryFn: () => apiGet<{ items: BlastTemplate[] }>("/api/whatsapp/blaster/templates"),
  });
}

export function useSaveBlastTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<BlastTemplate> & { name: string; body: string }) =>
      apiPost<BlastTemplate>("/api/whatsapp/blaster/templates", body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success("Template saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useBlastCampaigns() {
  return useQuery({
    queryKey: [...KEY, "campaigns"],
    queryFn: () => apiGet<{ items: BlastCampaign[] }>("/api/whatsapp/blaster/campaigns"),
  });
}

export function useBlastCampaign(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "campaign", id],
    queryFn: () => apiGet<BlastCampaign>(`/api/whatsapp/blaster/campaigns/${id}`),
    enabled: Boolean(id),
    refetchInterval: (query) =>
      query.state.data?.status === "running" || query.state.data?.status === "scheduled"
        ? 5_000
        : false,
  });
}

export function useCreateBlastCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost<BlastCampaign>("/api/whatsapp/blaster/campaigns", body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBlastCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPatch<BlastCampaign>(`/api/whatsapp/blaster/campaigns/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useParseBlastContacts() {
  return useMutation({
    mutationFn: (body: {
      csvText?: string;
      fileBase64?: string;
      fileName?: string;
      mapping?: Partial<WhatsAppColumnMapping>;
    }) =>
      apiPost<ParsedWhatsAppContactList & { mapping: WhatsAppColumnMapping }>(
        "/api/whatsapp/blaster/parse",
        body,
      ),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReplaceBlastContacts(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiPost<{ total: number; loaded: number; invalid: number; duplicates: number }>(
        `/api/whatsapp/blaster/campaigns/${campaignId}/contacts`,
        body,
      ),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success(`${data.loaded} valid contacts loaded`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCampaignAction(campaignId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: "start" | "pause" | "resume" | "stop") =>
      apiPost<BlastCampaign>(`/api/whatsapp/blaster/campaigns/${campaignId}/${action}`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useWhatsAppInbox() {
  return useQuery({
    queryKey: [...KEY, "inbox"],
    queryFn: () => apiGet<{ items: BlastContact[] }>("/api/whatsapp/blaster/inbox"),
    refetchInterval: 5_000,
  });
}

export function useWhatsAppThread(contactId: string | null) {
  return useQuery({
    queryKey: [...KEY, "thread", contactId],
    queryFn: () =>
      apiGet<{ contact: BlastContact; items: BlastMessage[] }>(
        `/api/whatsapp/blaster/inbox/${contactId}`,
      ),
    enabled: Boolean(contactId),
    refetchInterval: 5_000,
  });
}

export function useReplyWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { contactId: string; text: string }) =>
      apiPost<BlastMessage>(`/api/whatsapp/blaster/inbox/${input.contactId}/reply`, {
        text: input.text,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useWhatsAppLeads() {
  return useQuery({
    queryKey: [...KEY, "leads"],
    queryFn: () => apiGet<{ items: WhatsAppLeadRow[] }>("/api/whatsapp/blaster/leads"),
    refetchInterval: 10_000,
  });
}

export function useWhatsAppLead(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "lead", id],
    queryFn: () => apiGet<WhatsAppLeadRow>(`/api/whatsapp/blaster/leads/${id}`),
    enabled: Boolean(id),
  });
}

export function useConvertWhatsAppLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiPost<{ leadId: string; alreadyConverted: boolean }>(
        `/api/whatsapp/blaster/leads/${id}/convert`,
        {},
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success("Converted to CRM lead");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useWhatsAppReports() {
  return useQuery({
    queryKey: [...KEY, "reports"],
    queryFn: () =>
      apiGet<{
        totalCampaigns: number;
        totalMessagesSent: number;
        overallDeliveryRate: number;
        overallInterestRate: number;
        totalLeadsGenerated: number;
        provider: WhatsAppProviderInfo;
      }>("/api/whatsapp/blaster/reports"),
  });
}

export function useCampaignReport(id: string | null) {
  return useQuery({
    queryKey: [...KEY, "report", id],
    queryFn: () => apiGet<Record<string, unknown>>(`/api/whatsapp/blaster/campaigns/${id}/report`),
    enabled: Boolean(id),
  });
}

export function downloadCampaignExport(campaignId: string, filename: string) {
  return apiDownload(`/api/whatsapp/blaster/campaigns/${campaignId}/export`, filename);
}

export function downloadCampaignPdf(campaignId: string, filename: string) {
  return apiDownload(`/api/whatsapp/blaster/campaigns/${campaignId}/report.pdf`, filename);
}

export async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
