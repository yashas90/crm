"use client";

import { DocumentThumbnail } from "@/components/documents/document-thumbnail";
import {
  type Document,
  formatFileSize,
  useDeleteDocument,
  useDocumentSignedUrl,
} from "@/hooks/use-documents";
import { useSession } from "@/hooks/use-session";
import { Button } from "@propninja/ui/button";
import { Copy, Share2, Trash2 } from "lucide-react";

type DocumentCardProps = {
  document: Document;
  onShare?: (document: Document) => void;
  showDelete?: boolean;
};

export function DocumentCard({ document, onShare, showDelete }: DocumentCardProps) {
  const { session } = useSession();
  const deleteDoc = useDeleteDocument();
  const signedUrl = useDocumentSignedUrl();
  const canDelete = showDelete && (session?.role === "admin" || session?.role === "manager");

  async function handleCopyLink() {
    const result = await signedUrl.mutateAsync(document.id);
    await navigator.clipboard.writeText(result.signedUrl);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="aspect-[4/3] overflow-hidden border-b border-border">
        <DocumentThumbnail
          fileType={document.fileType}
          fileUrl={document.fileUrl}
          name={document.name}
        />
      </div>
      <div className="space-y-2 p-4">
        <div>
          <p className="font-medium leading-tight">{document.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(document.fileSizeMb)} · {document.fileType.toUpperCase()}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(document.createdAt).toLocaleDateString("en-IN")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onShare ? (
            <Button size="sm" variant="secondary" onClick={() => onShare(document)}>
              <Share2 className="mr-1.5 h-3.5 w-3.5" />
              Share
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => void handleCopyLink()}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy link
          </Button>
          {canDelete ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              onClick={() => void deleteDoc.mutateAsync(document.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
