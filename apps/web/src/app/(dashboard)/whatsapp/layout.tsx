"use client";

import { AccessDeniedEmptyState } from "@/components/common/access-denied-empty-state";
import { WhatsAppSubnav } from "@/components/whatsapp/whatsapp-subnav";
import { useSession } from "@/hooks/use-session";

export default function WhatsAppLayout({ children }: { children: React.ReactNode }) {
  const { ready, isAdmin } = useSession();

  if (ready && !isAdmin) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">💬 WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Blast campaigns, inbox replies, WhatsApp leads, and reports.
          </p>
        </div>
        <AccessDeniedEmptyState description="Only admins can access WhatsApp Blaster." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">💬 WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Blast campaigns, inbox replies, WhatsApp leads, and reports — separate from the main CRM
          pipeline.
        </p>
      </div>
      {ready ? (
        <>
          <WhatsAppSubnav />
          {children}
        </>
      ) : null}
    </div>
  );
}
