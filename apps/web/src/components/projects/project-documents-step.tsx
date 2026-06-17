"use client";

import { DocumentsLibrary } from "@/components/documents/documents-library";

type ProjectDocumentsStepProps = {
  projectId: string;
  readOnly?: boolean;
};

export function ProjectDocumentsStep({ projectId, readOnly }: ProjectDocumentsStepProps) {
  if (readOnly) {
    return <DocumentsLibrary projectId={projectId} compact />;
  }
  return <DocumentsLibrary projectId={projectId} compact />;
}
