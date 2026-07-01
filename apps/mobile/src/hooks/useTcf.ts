import { apiGet, apiPost } from "@/lib/apiClient";
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

export function tcfConsentQueryKey(leadId: string) {
  return ["tcf", "consent", leadId] as const;
}

/** Latest consent per channel for a lead (GET /api/tcf/consent/:leadId). */
export function useTcfForLead(leadId: string) {
  return useQuery({
    queryKey: tcfConsentQueryKey(leadId),
    queryFn: () => apiGet<TcfConsentByChannel>(`/api/tcf/consent/${leadId}`),
    enabled: Boolean(leadId),
    meta: { suppressErrorToast: true },
  });
}

export function getChannelConsent(
  data: TcfConsentByChannel | undefined,
  channel: ConsentType,
): boolean | null {
  const record = data?.consents?.[channel];
  if (!record) return null;
  return record.consented;
}

/** Call-channel consent: true = OK, false = do not call, null = unknown. */
export function getCallConsent(data: TcfConsentByChannel | undefined): boolean | null {
  return getChannelConsent(data, "call");
}

export function useUpsertTcfConsent(leadId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { consent_type: ConsentType; consented: boolean }) =>
      apiPost<TcfConsentRecord>("/api/tcf/consent", {
        lead_id: leadId,
        consent_type: input.consent_type,
        consented: input.consented,
        source: "mobile_app",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tcfConsentQueryKey(leadId) });
    },
  });
}
