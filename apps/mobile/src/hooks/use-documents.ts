import { apiDelete, apiGet, apiPost, getApiUrl } from "@/lib/apiClient";
import { getToken } from "@/lib/auth";
import { queryKeys } from "@/lib/queryKeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type DocumentFileType = "pdf" | "image" | "other";
export type SharedVia = "whatsapp" | "email" | "link";

export type Document = {
  id: string;
  name: string;
  description: string | null;
  fileUrl: string;
  fileType: DocumentFileType;
  fileSizeMb: number;
  projectId: string | null;
  isGlobal: boolean;
  createdAt: string;
};

export type LeadDocumentShare = {
  id: string;
  leadId: string;
  documentId: string;
  sharedVia: SharedVia;
  sharedAt: string;
  viewedAt: string | null;
  document: Pick<Document, "id" | "name" | "fileType" | "fileUrl" | "fileSizeMb">;
  sharer: { id: string; name: string };
};

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function useDocuments(search?: string) {
  return useQuery({
    queryKey: queryKeys.documents.list(search ?? ""),
    queryFn: () => apiGet<{ items: Document[] }>(`/api/documents${buildQuery({ search })}`),
  });
}

export function useLeadDocuments(leadId: string) {
  return useQuery({
    queryKey: queryKeys.documents.lead(leadId),
    queryFn: () => apiGet<{ items: LeadDocumentShare[] }>(`/api/leads/${leadId}/documents`),
    enabled: Boolean(leadId),
  });
}

export async function uploadDocumentMultipart(formData: FormData): Promise<Document> {
  const token = getToken();
  const headers: Record<string, string> = { Accept: "application/json" };
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

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadDocumentMultipart,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useShareDocument(leadId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      documentId,
      sharedVia,
    }: {
      documentId: string;
      sharedVia: SharedVia;
    }) =>
      apiPost<LeadDocumentShare & { viewUrl: string }>(`/api/documents/${documentId}/share`, {
        leadId,
        sharedVia,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lead-documents", leadId] });
    },
  });
}

export function useDocumentSignedUrl() {
  return useMutation({
    mutationFn: (documentId: string) =>
      apiGet<{ signedUrl: string }>(`/api/documents/${documentId}/signed-url`),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/documents/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function formatFileSize(mb: number): string {
  if (mb < 1) return `${Math.round(mb * 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}
