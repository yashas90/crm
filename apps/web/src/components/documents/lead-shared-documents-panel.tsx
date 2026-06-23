"use client";

import { ShareDocumentPickerDialog } from "@/components/documents/share-document-picker-dialog";
import { Badge } from "@/components/ui/badge";
import {
  type LeadDocumentShare,
  useDocumentSignedUrl,
  useLeadDocuments,
  useShareDocument,
} from "@/hooks/use-documents";
import { Button } from "@propninja/ui/button";
import { MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";

type LeadSharedDocumentsPanelProps = {
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
};

function viaLabel(via: LeadDocumentShare["sharedVia"]) {
  if (via === "whatsapp") return "WhatsApp";
  if (via === "email") return "Email";
  return "Link";
}

export function LeadSharedDocumentsPanel({
  leadId,
  leadName,
  leadPhone,
}: LeadSharedDocumentsPanelProps) {
  const { data, isLoading } = useLeadDocuments(leadId);
  const share = useShareDocument();
  const signedUrl = useDocumentSignedUrl();
  const [pickerOpen, setPickerOpen] = useState(false);

  const items = data?.items ?? [];

  async function shareViaWhatsApp(documentId: string) {
    const shareRecord = await share.mutateAsync({
      documentId,
      leadId,
      sharedVia: "whatsapp",
    });
    const urlResult = await signedUrl.mutateAsync(documentId);
    const phone = leadPhone?.replace(/\D/g, "") ?? "";
    const text = encodeURIComponent(
      `Hi ${leadName}, please find the brochure here: ${urlResult.signedUrl}`,
    );
    const waUrl = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    return shareRecord;
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Documents shared with this lead</p>
        <Button size="sm" onClick={() => setPickerOpen(true)}>
          <Share2 className="mr-1.5 h-3.5 w-3.5" />
          Share a document
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents shared yet.</p>
      ) : (
        <div className="overflow-x-auto border-2 border-black">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Document</th>
                <th className="px-4 py-2">Shared by</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Via</th>
                <th className="px-4 py-2">Viewed</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{row.document.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.sharer.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(row.sharedAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">{viaLabel(row.sharedVia)}</td>
                  <td className="px-4 py-3">
                    {row.viewedAt ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">Viewed</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void shareViaWhatsApp(row.documentId)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ShareDocumentPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        leadId={leadId}
        leadName={leadName}
        leadPhone={leadPhone}
      />
    </div>
  );
}
