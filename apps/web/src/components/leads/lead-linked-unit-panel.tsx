"use client";

import { openBookingPdf } from "@/hooks/use-bookings";
import type { LeadLinkedUnit } from "@/hooks/use-message-templates";
import { UNIT_STATUS_LABELS, type UnitStatus } from "@propninja/types";
import { Button } from "@propninja/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@propninja/ui/card";
import { cn } from "@propninja/ui/lib/utils";
import { Download } from "lucide-react";
import Link from "next/link";

const STATUS_STYLES: Record<UnitStatus, string> = {
  available: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  reserved: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  booked: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  sold: "bg-muted text-muted-foreground",
};

function formatPrice(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  return `₹${n.toLocaleString("en-IN")}`;
}

type LeadLinkedUnitPanelProps = {
  linkedUnit: LeadLinkedUnit | null | undefined;
  isLoading?: boolean;
};

export function LeadLinkedUnitPanel({ linkedUnit, isLoading }: LeadLinkedUnitPanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Linked unit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  if (!linkedUnit) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Linked unit</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No unit reserved or booked for this lead yet. Reserve from{" "}
            <Link href="/projects" className="text-primary hover:underline">
              project inventory
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  const status = linkedUnit.status as UnitStatus;
  const showPdf =
    (status === "booked" || status === "sold") && linkedUnit.bookingDocument?.bookingRef;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base">Linked unit</CardTitle>
          <p className="text-sm text-muted-foreground">{linkedUnit.projectName}</p>
        </div>
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
            STATUS_STYLES[status] ?? "",
          )}
        >
          {UNIT_STATUS_LABELS[status] ?? status}
        </span>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Unit</p>
            <Link
              href={`/projects/${linkedUnit.projectId}?step=inventory`}
              className="font-medium text-primary hover:underline"
            >
              {linkedUnit.unitNumber}
            </Link>
            <p className="text-muted-foreground">
              Floor {linkedUnit.floor} · {linkedUnit.bedrooms} BHK · {linkedUnit.areaSqFt} sqft
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="font-medium">
              {linkedUnit.priceFinalRs != null
                ? formatPrice(linkedUnit.priceFinalRs)
                : formatPrice(linkedUnit.priceListedRs)}
            </p>
            {linkedUnit.priceFinalRs != null ? (
              <p className="text-xs text-muted-foreground">
                Listed {formatPrice(linkedUnit.priceListedRs)}
              </p>
            ) : null}
          </div>
        </div>

        {showPdf ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <span className="font-mono text-xs">{linkedUnit.bookingDocument!.bookingRef}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void openBookingPdf(linkedUnit.projectId, linkedUnit.id)}
            >
              <Download className="mr-2 h-4 w-4" />
              Booking PDF
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
