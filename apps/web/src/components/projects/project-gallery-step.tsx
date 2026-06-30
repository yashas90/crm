"use client";

import { ProjectWizardFooter } from "@/components/projects/project-wizard-footer";
import type { ProjectDetail } from "@/hooks/use-projects";
import { useDeleteProjectGalleryItem, useUploadProjectGalleryImage } from "@/hooks/use-projects";
import { getErrorMessage } from "@/lib/errors";
import type { ProjectGalleryItem } from "@/lib/project-wizard-types";
import { toast } from "@/lib/toast";
import { Button } from "@propninja/ui/button";
import { ImagePlus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

type ProjectGalleryStepProps = {
  project: ProjectDetail;
  readOnly?: boolean;
  onSaved?: () => void;
};

export function ProjectGalleryStep({
  project,
  readOnly = false,
  onSaved,
}: ProjectGalleryStepProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadProjectGalleryImage(project.id);
  const remove = useDeleteProjectGalleryItem(project.id);
  const [items, setItems] = useState<ProjectGalleryItem[]>(project.gallery?.items ?? []);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList?.length || readOnly) return;

    for (const file of Array.from(fileList)) {
      try {
        const result = await upload.mutateAsync(file);
        setItems(result.gallery?.items ?? []);
        onSaved?.();
      } catch (err) {
        toast.error(getErrorMessage(err, "Upload failed"));
      }
    }
  }

  async function handleRemove(itemId: string) {
    try {
      const result = await remove.mutateAsync(itemId);
      setItems(result.gallery?.items ?? []);
      onSaved?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not remove image"));
    }
  }

  const busy = upload.isPending || remove.isPending;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200/80 bg-card p-6 shadow-sm dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Project gallery</h2>
            <p className="text-sm text-muted-foreground">
              Upload JPEG, PNG, or WebP images (max 10MB each).
            </p>
          </div>
          {!readOnly ? (
            <>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => void handleFilesSelected(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                {upload.isPending ? "Uploading…" : "Add images"}
              </Button>
            </>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No gallery images yet.</p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-lg border border-slate-200/80 bg-muted/20 dark:border-white/10"
              >
                {item.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt={item.name} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    {item.name}
                  </div>
                )}
                <div className="border-t border-slate-200/80 px-3 py-2 text-xs font-medium dark:border-white/10">
                  {item.name}
                </div>
                {!readOnly ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute right-2 top-2 h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                    disabled={busy}
                    onClick={() => void handleRemove(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <ProjectWizardFooter
        readOnly={readOnly}
        isSaving={busy}
        saveLabel="Continue"
        onCancel={() => onSaved?.()}
        onSave={() => onSaved?.()}
      />
    </div>
  );
}
