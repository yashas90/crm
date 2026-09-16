import { apiGet, apiPost } from "@/lib/apiClient";
import { enqueueRequest } from "@/lib/offlineQueue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useWhatsAppUnreadCount() {
  return useQuery({
    queryKey: ["wa-blaster", "unread"],
    queryFn: () => apiGet<{ count: number }>("/api/whatsapp/blaster/unread-count"),
    refetchInterval: 15_000,
  });
}

export function useWhatsAppCampaigns() {
  return useQuery({
    queryKey: ["wa-blaster", "campaigns"],
    queryFn: () =>
      apiGet<{ items: Array<Record<string, unknown>> }>("/api/whatsapp/blaster/campaigns"),
  });
}

export function useWhatsAppInbox() {
  return useQuery({
    queryKey: ["wa-blaster", "inbox"],
    queryFn: () =>
      apiGet<{
        items: Array<{
          id: string;
          name: string;
          phone: string;
          status: string;
          campaignName?: string;
          unreadCount: number;
        }>;
      }>("/api/whatsapp/blaster/inbox"),
    refetchInterval: 8_000,
  });
}

export function useWhatsAppLeads() {
  return useQuery({
    queryKey: ["wa-blaster", "leads"],
    queryFn: () =>
      apiGet<{
        items: Array<{
          id: string;
          leadCode: string;
          name: string;
          contactPhone: string;
          sourceCampaign: string | null;
          budgetAnswer: string | null;
          locationAnswer: string | null;
          timelineAnswer: string | null;
          interestAt: string | null;
          assignedAgentName?: string | null;
        }>;
      }>("/api/whatsapp/blaster/leads"),
  });
}

export function useParseWhatsAppFile() {
  return useMutation({
    mutationFn: (body: { fileBase64: string; fileName: string }) =>
      apiPost<{
        headers: string[];
        contacts: Array<{
          name: string;
          phone: string;
          formattedPhone: string | null;
          city: string;
          budget: string;
          valid: boolean;
        }>;
        total: number;
        valid: number;
        invalid: number;
        duplicates: number;
      }>("/api/whatsapp/blaster/parse", body),
  });
}

export async function replyWhatsAppOrQueue(contactId: string, text: string) {
  try {
    return await apiPost(`/api/whatsapp/blaster/inbox/${contactId}/reply`, { text });
  } catch (err) {
    await enqueueRequest({
      method: "POST",
      path: `/api/whatsapp/blaster/inbox/${contactId}/reply`,
      body: { text },
    });
    throw err;
  }
}

export function useReplyWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, text }: { contactId: string; text: string }) =>
      replyWhatsAppOrQueue(contactId, text),
    onSettled: () => void qc.invalidateQueries({ queryKey: ["wa-blaster"] }),
  });
}
