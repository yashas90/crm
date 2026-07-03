import { apiGet } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";

export type MessageTemplate = {
  id: string;
  name: string;
  content: string;
  category: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export function useMessageTemplates(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["message-templates"],
    queryFn: () => apiGet<{ items: MessageTemplate[] }>("/api/message-templates"),
    enabled: options?.enabled ?? true,
  });
}

export type LeadLinkedUnit = {
  id: string;
  unitNumber: string;
  floor: number;
  bedrooms: number;
  areaSqFt: string;
  status: string;
  priceListedRs: number;
  priceFinalRs: number | null;
  projectId: string;
  projectName: string;
  bookingDocument?: {
    id: string;
    bookingRef: string;
    fileKey: string;
    fileUrl: string;
    generatedAt: string;
  } | null;
};

export function useLeadLinkedUnit(leadId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["leads", leadId, "linked-unit"],
    queryFn: () => apiGet<LeadLinkedUnit | null>(`/api/leads/${leadId}/linked-unit`),
    enabled: Boolean(leadId) && (options?.enabled ?? true),
    meta: { suppressErrorToast: true },
  });
}
