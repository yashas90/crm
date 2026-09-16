import { WhatsAppSubnav } from "@/components/whatsapp/whatsapp-subnav";

export default function WhatsAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">💬 WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Blast campaigns, inbox replies, WhatsApp leads, and reports — separate from the main CRM
          pipeline.
        </p>
      </div>
      <WhatsAppSubnav />
      {children}
    </div>
  );
}
