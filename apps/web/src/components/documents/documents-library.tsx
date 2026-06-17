"use client";

import { DocumentCard } from "@/components/documents/document-card";
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog";
import { type Document, type DocumentFileType, useDocuments } from "@/hooks/use-documents";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { useMemo, useState } from "react";

type DocumentsLibraryProps = {
  projectId?: string;
  compact?: boolean;
  onShare?: (document: Document) => void;
};

export function DocumentsLibrary({ projectId, compact, onShare }: DocumentsLibraryProps) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fileType, setFileType] = useState<DocumentFileType | "">("");

  const params = useMemo(
    () => ({
      projectId,
      fileType: fileType || undefined,
      search: search || undefined,
    }),
    [projectId, fileType, search],
  );

  const { data, isLoading } = useDocuments(params);
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
            <p className="text-sm text-muted-foreground">
              Brochures, floor plans, and property videos for sharing with leads
            </p>
          </div>
          <Button onClick={() => setUploadOpen(true)}>Upload document</Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            Upload to project
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={fileType}
          onChange={(e) => setFileType(e.target.value as DocumentFileType | "")}
        >
          <option value="">All types</option>
          <option value="pdf">PDF</option>
          <option value="image">Images</option>
          <option value="other">Video / other</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading documents…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((doc) => (
            <DocumentCard key={doc.id} document={doc} onShare={onShare} showDelete />
          ))}
        </div>
      )}

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} projectId={projectId} />
    </div>
  );
}
