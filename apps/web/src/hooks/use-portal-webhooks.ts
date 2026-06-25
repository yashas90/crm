"use client";

import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type PortalName = "99acres" | "magicbricks" | "housing" | "indiamrt" | "other";

export type PortalFieldMapping = {
  name: string;
  phone: string;
  email?: string;
  message?: string;
  projectInterest?: string;
};

export type PortalWebhook = {
  id: string;
  portalName: PortalName;
  webhookToken: string;
  fieldMapping: PortalFieldMapping;
  isActive: boolean;
  lastLeadReceivedAt: string | null;
  createdAt: string;
  webhookUrl: string;
};

export type PortalLeadPreview = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  leadSource: string;
  projectName: string | null;
  notes: string | null;
  merged: boolean;
  existingLeadId: string | null;
};

const portalWebhooksKey = ["portal-webhooks"] as const;

export function usePortalWebhooks(enabled = true) {
  return useQuery({
    queryKey: portalWebhooksKey,
    enabled,
    queryFn: async () => {
      const res = await apiGet<{ items: PortalWebhook[] }>("/api/admin/portal-webhooks");
      return res.items;
    },
  });
}

export function useCreatePortalWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { portalName: PortalName; fieldMapping?: PortalFieldMapping }) =>
      apiPost<PortalWebhook>("/api/admin/portal-webhooks", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portalWebhooksKey });
      toast.success("Portal webhook created");
    },
    onError: () => toast.error("Failed to create portal webhook"),
  });
}

export function useUpdatePortalWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      id: string;
      fieldMapping?: PortalFieldMapping;
      isActive?: boolean;
    }) =>
      apiPatch<PortalWebhook>(`/api/admin/portal-webhooks/${input.id}`, {
        fieldMapping: input.fieldMapping,
        isActive: input.isActive,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: portalWebhooksKey });
      toast.success("Portal webhook updated");
    },
    onError: () => toast.error("Failed to update portal webhook"),
  });
}

export function useTestPortalWebhookPreview() {
  return useMutation({
    mutationFn: (body: {
      portalName: PortalName;
      fieldMapping?: PortalFieldMapping;
      payload: Record<string, unknown>;
    }) => apiPost<{ preview: PortalLeadPreview }>("/api/admin/portal-webhooks/test-preview", body),
    onError: () => toast.error("Failed to preview webhook payload"),
  });
}

export function useTestPortalWebhookById() {
  return useMutation({
    mutationFn: (id: string) =>
      apiPost<{ preview: PortalLeadPreview; mockPayload: Record<string, string> }>(
        `/api/admin/portal-webhooks/${id}/test`,
        {},
      ),
    onError: () => toast.error("Failed to test webhook"),
  });
}
