"use client";

import { apiGet, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type ConsentType = "call" | "sms" | "email";

export type TcfConsentRecord = {
  id: string;
  consent_type: ConsentType;
  consented: boolean;
  consented_at: string;
  revoked_at: string | null;
  source: string | null;
  ip_address: string | null;
};

export type TcfConsentByChannel = {
  lead_id: string;
  consents: Record<ConsentType, TcfConsentRecord | null>;
};

export function useTcfConsent(leadId: string) {
  return useQuery({
    queryKey: ["tcf", "consent", leadId],
    queryFn: () => apiGet<TcfConsentByChannel>(`/api/tcf/consent/${leadId}`),
    enabled: Boolean(leadId),
  });
}

export function useUpsertTcfConsent(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { consent_type: ConsentType; consented: boolean }) =>
      apiPost<TcfConsentRecord>("/api/tcf/consent", {
        lead_id: leadId,
        consent_type: payload.consent_type,
        consented: payload.consented,
        source: "web-dashboard",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tcf", "consent", leadId] });
      toast.success("Consent updated");
    },
    onError: () => toast.error("Failed to update consent"),
  });
}
