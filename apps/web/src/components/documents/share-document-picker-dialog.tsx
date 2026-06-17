"use client";

import { DocumentThumbnail } from "@/components/documents/document-thumbnail";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type Document,
  formatFileSize,
  useDocumentSignedUrl,
  useDocuments,
  useShareDocument,
} from "@/hooks/use-documents";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Link2, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";

type ShareDocumentPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
};

export function ShareDocumentPickerDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadPhone,
}: ShareDocumentPickerDialogProps) {
  const [search, setSearch] = useState("");
  const { data } = useDocuments({ search: search || undefined });
  const share = useShareDocument();
  const signedUrl = useDocumentSignedUrl();

  const items = useMemo(() => data?.items ?? [], [data?.items]);

  async function shareViaWhatsApp(doc: Document) {
    await share.mutateAsync({ documentId: doc.id, leadId, sharedVia: "whatsapp" });
    const urlResult = await signedUrl.mutateAsync(doc.id);
    const phone = leadPhone?.replace(/\D/g, "") ?? "";
    const text = encodeURIComponent(
      `Hi ${leadName}, please find the brochure here: ${urlResult.signedUrl}`,
    );
    const waUrl = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  async function copyTrackedLink(doc: Document) {
    const record = await share.mutateAsync({ documentId: doc.id, leadId, sharedVia: "link" });
    await navigator.clipboard.writeText(record.viewUrl);
    toast.success("Tracked link copied");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share a document</DialogTitle>
          <DialogDescription>
            Choose a brochure or floor plan to share with {leadName}
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search library…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-96 space-y-2 overflow-y-auto">
          {items.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md border border-border">
                <DocumentThumbnail fileType={doc.fileType} fileUrl={doc.fileUrl} name={doc.name} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(doc.fileSizeMb)} · {doc.fileType}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => void shareViaWhatsApp(doc)}>
                  <MessageCircle className="mr-1 h-3.5 w-3.5" />
                  WhatsApp
                </Button>
                <Button size="sm" variant="outline" onClick={() => void copyTrackedLink(doc)}>
                  <Link2 className="mr-1 h-3.5 w-3.5" />
                  Copy link
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
