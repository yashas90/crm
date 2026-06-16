"use client";

import { ProjectWizardFooter } from "@/components/projects/project-wizard-footer";
import type { ProjectDetail } from "@/hooks/use-projects";
import { ImageOff } from "lucide-react";
import { useRouter } from "next/navigation";

type ProjectGalleryStepProps = {
  project: ProjectDetail;
  readOnly?: boolean;
  onSaved?: () => void;
};

/** Shown only when gallery is re-enabled in project-wizard; otherwise the step is hidden. */
export function ProjectGalleryStep({
  project: _project,
  readOnly = false,
}: ProjectGalleryStepProps) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border/60 bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <ImageOff className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold">Gallery uploads coming soon</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Image upload and storage are not available yet. Project photos will be supported in a
            future release.
          </p>
        </div>
      </section>

      <ProjectWizardFooter
        readOnly={readOnly}
        isSaving={false}
        saveLabel="Back to projects"
        onCancel={() => router.push("/projects")}
        onSave={() => router.push("/projects")}
      />
    </div>
  );
}
