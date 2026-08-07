"use client";

import { DocumentsLibrary } from "@/components/documents/documents-library";

type ProjectDocumentsStepProps = {
  projectId: string;
  readOnly?: boolean;
};

export function ProjectDocumentsStep({ projectId }: ProjectDocumentsStepProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200/80 bg-card p-6 shadow-sm dark:border-white/10">
        <h2 className="text-base font-semibold">Brochures & Documents</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Toggle &quot;Visible on customer page&quot; on any document to show it as a download on
          the customer visit page.
        </p>
        <div className="mt-4">
          <DocumentsLibrary projectId={projectId} compact />
        </div>
      </section>
    </div>
  );
}
