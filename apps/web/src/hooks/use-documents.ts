"use client";

import { apiDelete, apiGet, apiPost } from "@/lib/apiClient";
import { getToken } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

let cachedApiUrl: string | undefined;

function resolveApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (process.env.NODE_ENV === "production") {
    if (!configured || configured.includes("localhost")) {
      throw new Error("NEXT_PUBLIC_API_URL must be set in production.");
    }
    return configured.replace(/\/$/, "");
  }
  return configured?.replace(/\/$/, "") ?? "http://localhost:3001";
}

function getApiUrl(): string {
  if (!cachedApiUrl) cachedApiUrl = resolveApiUrl();
  return cachedApiUrl;
}

export type DocumentFileType = "pdf" | "image" | "other";
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
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${getApiUrl()}/api/documents/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  const json = await response.json();
  if (!response.ok || !json.ok) {
    throw new Error(json.error?.message ?? "Upload failed");
  }
  return json.data as Document;
}

export function useDocuments(params: ListDocumentsParams = {}) {
  return useQuery({
    queryKey: documentsQueryKey(params),
    queryFn: () =>
      apiGet<{ items: Document[]; total: number; page: number; pageSize: number }>(
        `/api/documents${buildQuery(params)}`,
      ),
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

export { getApiUrl, buildQuery };
