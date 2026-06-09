"use client";

import { ProjectWizardFooter } from "@/components/projects/project-wizard-footer";
import type { ProjectDetail } from "@/hooks/use-projects";
import { useUpdateProject } from "@/hooks/use-projects";
import { getErrorMessage } from "@/lib/errors";
import { type ProjectGalleryItem, normalizeGalleryInfo } from "@/lib/project-wizard-types";
import { Button } from "@propninja/ui/button";
import { cn } from "@propninja/ui/lib/utils";
import { ImagePlus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ProjectGalleryStepProps = {
  project: ProjectDetail;
  readOnly?: boolean;
  onSaved?: () => void;
};

function makePlaceholderItem(name: string): ProjectGalleryItem {
  return {
    id: crypto.randomUUID(),
    name,
    placeholder: true,
  };
}

export function ProjectGalleryStep({
  project,
  readOnly = false,
  onSaved,
}: ProjectGalleryStepProps) {
  const router = useRouter();
  const updateProject = useUpdateProject();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ProjectGalleryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(normalizeGalleryInfo(project.gallery).items);
  }, [project.gallery]);

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || readOnly) return;
    const next = Array.from(fileList).map((file) => makePlaceholderItem(file.name));
    setItems((current) => [...current, ...next]);
  }

  function handleSave() {
    setError(null);
    updateProject.mutate(
      { projectId: project.id, payload: { gallery: { items } } },
      {
        onSuccess: () => onSaved?.(),
        onError: (err) => setError(getErrorMessage(err, "Failed to save gallery")),
      },
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Gallery</h2>
          <p className="text-sm text-muted-foreground">
            Upload project images. File storage is not connected yet — selections are saved as
            placeholders.
          </p>
        </div>

        <div
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 bg-muted/10 px-6 py-10 text-center",
            !readOnly && "cursor-pointer hover:bg-muted/20",
          )}
          onClick={() => {
            if (!readOnly) fileInputRef.current?.click();
          }}
          onKeyDown={(event) => {
            if (!readOnly && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          role={readOnly ? undefined : "button"}
          tabIndex={readOnly ? undefined : 0}
        >
          <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Drag & drop or click to upload</p>
          <p className="mt-1 text-sm text-muted-foreground">PNG, JPG up to 10MB (stub only)</p>
          {!readOnly ? (
            <Button type="button" variant="outline" size="sm" className="mt-4">
              <ImagePlus className="mr-2 h-4 w-4" />
              Choose files
            </Button>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={readOnly}
            onChange={(event) => {
              handleFilesSelected(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {items.length > 0 ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-3"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">Placeholder — not uploaded</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No gallery items yet.</p>
        )}
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <ProjectWizardFooter
        readOnly={readOnly}
        isSaving={updateProject.isPending}
        saveLabel="Save"
        onCancel={() => router.push("/projects")}
        onSave={handleSave}
      />
    </div>
  );
}
