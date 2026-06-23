"use client";

import type { ConsentType, TcfConsentByChannel } from "@/hooks/use-tcf";
import { useUpsertTcfConsent } from "@/hooks/use-tcf";
import { cn } from "@propninja/ui/lib/utils";
import { ShieldCheck } from "lucide-react";

const CHANNELS: { type: ConsentType; label: string; toggleLabel: string }[] = [
  { type: "call", label: "Call", toggleLabel: "Allowed to call" },
  { type: "sms", label: "SMS", toggleLabel: "Allowed to SMS" },
  { type: "email", label: "Email", toggleLabel: "Allowed to email" },
];

function channelStatus(consented: boolean | null) {
  if (consented === true) return { text: "Allowed", className: "text-emerald-600" };
  if (consented === false) return { text: "Not allowed", className: "text-rose-600" };
  return { text: "Unknown", className: "text-muted-foreground" };
}

/** Hero chip reflects call consent only (primary outbound channel). */
export function ComplianceChip({ callConsent }: { callConsent: boolean | null }) {
  if (callConsent === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <ShieldCheck className="h-3 w-3" />
        Compliance
      </span>
    );
  }
  if (callConsent === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
        <ShieldCheck className="h-3 w-3" />
        Compliance
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
      <ShieldCheck className="h-3 w-3" />
      Compliance
    </span>
  );
}

function ConsentSwitch({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          checked ? "bg-primary" : "bg-muted",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

type TcfConsentPanelProps = {
  leadId: string;
  data?: TcfConsentByChannel;
  isLoading?: boolean;
};

export function TcfConsentPanel({ leadId, data, isLoading }: TcfConsentPanelProps) {
  const upsert = useUpsertTcfConsent(leadId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading consent records...</p>;
  }

  function handleToggle(consentType: ConsentType, consented: boolean) {
    upsert.mutate({ consent_type: consentType, consented });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        TCF consent per channel. Updates are stored via POST /api/tcf/consent.
      </p>

      <div className="divide-y border-2 border-black">
        {CHANNELS.map(({ type, label, toggleLabel }) => {
          const record = data?.consents[type] ?? null;
          const consented = record ? record.consented : null;
          const status = channelStatus(consented);

          return (
            <div key={type} className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold capitalize">{label}</span>
                <span className={cn("text-xs font-medium", status.className)}>{status.text}</span>
              </div>
              <ConsentSwitch
                label={toggleLabel}
                checked={consented === true}
                disabled={upsert.isPending}
                onChange={(next) => handleToggle(type, next)}
              />
              {record?.consented_at ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Last updated {new Date(record.consented_at).toLocaleString()}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
