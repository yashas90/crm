"use client";

import { useTcfMutations, useTransactionClosures } from "@/hooks/use-transaction-closures";
import { getErrorMessage } from "@/lib/errors";
import { inr } from "@/lib/tcf-form";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUSES = ["", "draft", "pending_approval", "approved", "rejected"] as const;

export function TcfList() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const list = useTransactionClosures(search, status);
  const { duplicate, remove } = useTcfMutations();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Transaction closure</h1>
          <p className="text-sm text-slate-500">
            Incentive is counted only after an admin approves the TCF, and it stays provisional
            until the invoice is collected.
          </p>
        </div>
        <Button type="button" onClick={() => router.push("/tcf/new")}>
          New TCF
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search code, product, or client"
          className="max-w-sm"
        />
        <select
          className="h-10 rounded-md border bg-transparent px-3 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {STATUSES.map((item) => (
            <option key={item || "all"} value={item}>
              {item ? item.replaceAll("_", " ") : "All statuses"}
            </option>
          ))}
        </select>
      </div>
      {list.isLoading ? <p className="text-sm text-slate-500">Loading closures…</p> : null}
      {list.isError ? <p className="text-sm text-rose-600">{getErrorMessage(list.error)}</p> : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase dark:bg-slate-900">
            <tr>
              <th className="px-3 py-2">TCF</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Closure</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Invoice</th>
              <th className="px-3 py-2">Net revenue</th>
              <th className="px-3 py-2">Incentive</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(list.data?.items ?? []).map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/tcf/${item.id}`} className="text-sky-700 hover:underline">
                    {item.tcfCode}
                  </Link>
                </td>
                <td className="px-3 py-2">{item.primaryApplicant || "—"}</td>
                <td className="px-3 py-2">{item.productName || "—"}</td>
                <td className="px-3 py-2">{item.dealClosureDate || "—"}</td>
                <td className="px-3 py-2 capitalize">{item.status.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">{item.invoiceStatus.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">{inr(item.netRevenue)}</td>
                <td className="px-3 py-2 text-slate-500">{item.incentiveNote}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        duplicate.mutate(item.id, {
                          onSuccess: (copy) => router.push(`/tcf/${copy.id}`),
                          onError: (error) => toast.error(getErrorMessage(error)),
                        })
                      }
                    >
                      Duplicate
                    </Button>
                    {item.status === "draft" || item.status === "rejected" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          remove.mutate(item.id, {
                            onError: (error) => toast.error(getErrorMessage(error)),
                          })
                        }
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {list.data && list.data.items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-slate-500" colSpan={9}>
                  No transaction closures yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
