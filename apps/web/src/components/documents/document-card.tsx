"use client";

import { DocumentThumbnail } from "@/components/documents/document-thumbnail";
import {
  type Document,
  type DocumentCategory,
  formatFileSize,
  useDeleteDocument,
  useDocumentSignedUrl,
  useUpdateDocument,
} from "@/hooks/use-documents";
import { useSession } from "@/hooks/use-session";
import { Button } from "@propninja/ui/button";
import { Copy, Share2, Trash2 } from "lucide-react";

type DocumentCardProps = {
  document: Document;
  onShare?: (document: Document) => void;
  showDelete?: boolean;
};

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  brochure: "Brochure",
  floor_plan: "Floor Plan",
  price_list: "Price List",
  other: "Other",
};

export function DocumentCard({ document, onShare, showDelete }: DocumentCardProps) {
  const { session } = useSession();
  const deleteDoc = useDeleteDocument();
  const updateDoc = useUpdateDocument();
  const signedUrl = useDocumentSignedUrl();
  const canManage =
    session?.role === "admin" || session?.role === "manager" || session?.role === "agent";
  const canDelete = showDelete && (session?.role === "admin" || session?.role === "manager");

  async function handleCopyLink() {
    const result = await signedUrl.mutateAsync(document.id);
    await navigator.clipboard.writeText(result.signedUrl);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-card shadow-sm dark:border-white/10">
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
            {document.category ? ` · ${CATEGORY_LABELS[document.category]}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(document.createdAt).toLocaleDateString("en-IN")}
          </p>
        </div>

        {canManage ? (
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-2">
            <label className="flex items-center justify-between gap-2 text-xs">
              <span>Visible on customer page</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={document.isPublic}
                disabled={updateDoc.isPending}
                onChange={(e) =>
                  void updateDoc.mutateAsync({ id: document.id, isPublic: e.target.checked })
                }
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">Category</span>
              <select
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                value={document.category ?? ""}
                disabled={updateDoc.isPending}
                onChange={(e) => {
                  const value = e.target.value;
                  void updateDoc.mutateAsync({
                    id: document.id,
                    category: value === "" ? null : (value as DocumentCategory),
                  });
                }}
              >
                <option value="">Uncategorized</option>
                <option value="brochure">Brochure</option>
                <option value="floor_plan">Floor Plan</option>
                <option value="price_list">Price List</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
        ) : null}

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
