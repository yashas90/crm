import { apiGet } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";

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

/** Latest consent per channel for a lead (GET /api/tcf/consent/:leadId). */
export function useTcfForLead(leadId: string) {
  return useQuery({
    queryKey: ["tcf", "consent", leadId],
    queryFn: () => apiGet<TcfConsentByChannel>(`/api/tcf/consent/${leadId}`),
    enabled: Boolean(leadId),
  });
}

/** Call-channel consent: true = OK, false = do not call, null = unknown. */
export function getCallConsent(data: TcfConsentByChannel | undefined): boolean | null {
  const record = data?.consents?.call;
  if (!record) return null;
  return record.consented;
}
