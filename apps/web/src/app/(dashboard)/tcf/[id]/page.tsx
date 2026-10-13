"use client";

import { TcfEditor } from "@/components/tcf/tcf-editor";
import { useTransactionClosure } from "@/hooks/use-transaction-closures";
import { getErrorMessage } from "@/lib/errors";
import { useParams } from "next/navigation";

export default function TcfDetailPage() {
  const params = useParams<{ id: string }>();
  const query = useTransactionClosure(params.id);
  if (query.isLoading) return <p className="text-sm text-slate-500">Loading TCF…</p>;
  if (query.isError) return <p className="text-sm text-rose-600">{getErrorMessage(query.error)}</p>;
  if (!query.data) return null;
  return <TcfEditor record={query.data} />;
}
