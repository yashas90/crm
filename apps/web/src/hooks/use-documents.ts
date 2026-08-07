"use client";

import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from "@/lib/apiClient";
import { toast } from "@/lib/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type DocumentFileType = "pdf" | "image" | "other";
export type DocumentCategory = "brochure" | "floor_plan" | "price_list" | "other";
export type SharedVia = "whatsapp" | "email" | "link";

export type Document = {
  id: string;
  name: string;
  description: string | null;
  fileUrl: string;
  originalName?: string | null;
  fileType: DocumentFileType;
  fileSizeMb: number;
  downloadCount?: number;
  projectId: string | null;
  uploadedBy: string;
  isGlobal: boolean;
  isPublic: boolean;
  category: DocumentCategory | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string } | null;
  uploader: { id: string; name: string } | null;
};

export type LeadDocumentShare = {
  id: string;
  leadId: string;
  documentId: string;
  sharedBy: string;
  sharedVia: SharedVia;
  shareToken: string;
  sharedAt: string;
  viewedAt: string | null;
  document: Pick<
    Document,
    "id" | "name" | "description" | "fileType" | "fileUrl" | "fileSizeMb" | "projectId"
  >;
  sharer: { id: string; name: string };
};

export type ListDocumentsParams = {
  projectId?: string;
  isGlobal?: boolean;
  fileType?: DocumentFileType;
  search?: string;
  page?: number;
  pageSize?: number;
};

function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function documentsQueryKey(params?: Record<string, unknown>) {
  return ["documents", params ?? {}] as const;
}

export function leadDocumentsQueryKey(leadId: string) {
  return ["lead-documents", leadId] as const;
}

export async function apiUploadDocument(formData: FormData): Promise<Document> {
  return apiUpload<Document>("/api/documents/upload", formData);
}

export function useDocuments(params: ListDocumentsParams = {}) {
  return useQuery({
    queryKey: documentsQueryKey(params),
    queryFn: () =>
      apiGet<{ items: Document[]; total: number; page: number; pageSize: number }>(
        `/api/documents${buildQuery(params)}`,
      ),
    meta: { errorContext: "documents", suppressErrorToast: true },
  });
}

export function useLeadDocuments(leadId: string) {
  return useQuery({
    queryKey: leadDocumentsQueryKey(leadId),
    queryFn: () => apiGet<{ items: LeadDocumentShare[] }>(`/api/leads/${leadId}/documents`),
    enabled: Boolean(leadId),
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiUploadDocument,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document uploaded");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      isPublic?: boolean;
      category?: DocumentCategory | null;
      name?: string;
      description?: string | null;
    }) => apiPatch<Document>(`/api/documents/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ id: string }>(`/api/documents/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useShareDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
      leadId,
      sharedVia,
    }: {
      documentId: string;
      leadId: string;
      sharedVia: SharedVia;
    }) =>
      apiPost<LeadDocumentShare & { viewUrl: string }>(`/api/documents/${documentId}/share`, {
        leadId,
        sharedVia,
      }),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: leadDocumentsQueryKey(vars.leadId) });
    },
  });
}

export function useDocumentSignedUrl() {
  return useMutation({
    mutationFn: (documentId: string) =>
      apiGet<{ signedUrl: string; expiresInSeconds: number }>(
        `/api/documents/${documentId}/signed-url`,
      ),
  });
}

export function formatFileSize(mb: number): string {
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export { buildQuery };
