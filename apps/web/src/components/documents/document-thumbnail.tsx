"use client";

import type { DocumentFileType } from "@/hooks/use-documents";
import { FileImage, FileText, Film } from "lucide-react";
import { useEffect, useState } from "react";

type DocumentThumbnailProps = {
  fileType: DocumentFileType;
  fileUrl: string;
  name: string;
  className?: string;
};

export function DocumentThumbnail({ fileType, fileUrl, name, className }: DocumentThumbnailProps) {
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);

  useEffect(() => {
    if (fileType !== "pdf") return;

    let cancelled = false;

    async function renderPdfThumb() {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        const doc = await pdfjs.getDocument({ url: fileUrl }).promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        if (!cancelled) setPdfPreview(canvas.toDataURL("image/png"));
      } catch {
        if (!cancelled) setPdfPreview(null);
      }
    }

    void renderPdfThumb();
    return () => {
      cancelled = true;
    };
  }, [fileType, fileUrl]);

  if (fileType === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fileUrl}
        alt={name}
        loading="lazy"
        className={className ?? "h-full w-full object-cover"}
      />
    );
  }

  if (fileType === "pdf" && pdfPreview) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pdfPreview}
        alt={name}
        loading="lazy"
        className={className ?? "h-full w-full object-cover"}
      />
    );
  }

  const Icon = fileType === "pdf" ? FileText : Film;
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-muted/40 ${className ?? ""}`}
    >
      <Icon className="h-10 w-10 text-muted-foreground" />
    </div>
  );
}
