"use client";

import { apiPost } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";
import { isRahulVermaniLead } from "@/lib/rahul-vermani-lead";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useState } from "react";

type LeadShamanthBackfillButtonProps = {
  leadId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  onApplied?: () => void;
};

export function LeadShamanthBackfillButton({
  leadId,
  firstName,
  lastName,
  phone,
  onApplied,
}: LeadShamanthBackfillButtonProps) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  if (!isRahulVermaniLead({ firstName, lastName, phone })) {
    return null;
  }

  async function applyHistory() {
    setPending(true);
    try {
      const result = await apiPost<{
        leadName: string;
        agentName: string;
        followUpCount: number;
        siteVisitDate: string;
      }>(`/api/admin/leads/${leadId}/apply-shamanth-history`, {});

      await queryClient.invalidateQueries({ queryKey: ["leads", leadId] });
      await queryClient.invalidateQueries({ queryKey: ["site-visits"] });
      await queryClient.invalidateQueries({ queryKey: ["leads", leadId, "assignments"] });

      toast.success(
        `${result.leadName} assigned to ${result.agentName} · ${result.followUpCount} follow-ups · site visit ${result.siteVisitDate}`,
      );
      onApplied?.();
    } catch (error) {
      toast.error(getErrorMessage(error, "Backfill failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => void applyHistory()}
      className="border-amber-300 text-amber-900 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-500/10"
    >
      <History className="mr-1.5 h-4 w-4" />
      {pending ? "Applying…" : "Apply Shamanth history"}
    </Button>
  );
}
