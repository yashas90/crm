"use client";

import { ProjectWizardFooter } from "@/components/projects/project-wizard-footer";
import type { ProjectDetail } from "@/hooks/use-projects";
import { useUpdateProject } from "@/hooks/use-projects";
import { getErrorMessage } from "@/lib/errors";
import { nextWizardStep } from "@/lib/project-wizard";
import { COMMON_AMENITIES } from "@/lib/project-wizard-types";
import { cn } from "@propninja/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ProjectAmenitiesStepProps = {
  project: ProjectDetail;
  readOnly?: boolean;
  onSaved?: () => void;
};

export function ProjectAmenitiesStep({
  project,
  readOnly = false,
  onSaved,
}: ProjectAmenitiesStepProps) {
  const router = useRouter();
  const updateProject = useUpdateProject();
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(project.amenities ?? []);
  }, [project.amenities]);

  function toggleAmenity(amenity: string) {
    if (readOnly) return;
    setSelected((current) =>
      current.includes(amenity)
        ? current.filter((value) => value !== amenity)
        : [...current, amenity],
    );
  }

  function handleSave() {
    setError(null);
    updateProject.mutate(
      { projectId: project.id, payload: { amenities: selected } },
      {
        onSuccess: () => onSaved?.(),
        onError: (err) => setError(getErrorMessage(err, "Failed to save amenities")),
      },
    );
  }

  return (
    <div className="space-y-4">
      <section className="border-2 border-black bg-card p-5 shadow-[2px_2px_0_0_#000]">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Amenities</h2>
          <p className="text-sm text-muted-foreground">
            Select amenities available in this project.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {COMMON_AMENITIES.map((amenity) => {
            const isSelected = selected.includes(amenity);
            return (
              <button
                key={amenity}
                type="button"
                disabled={readOnly}
                onClick={() => toggleAmenity(amenity)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background hover:bg-muted",
                  readOnly && "cursor-not-allowed opacity-60",
                )}
              >
                {amenity}
              </button>
            );
          })}
        </div>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <ProjectWizardFooter
        readOnly={readOnly}
        isSaving={updateProject.isPending}
        saveLabel={nextWizardStep("amenities") ? undefined : "Save"}
        onCancel={() => router.push("/projects")}
        onSave={handleSave}
      />
    </div>
  );
}
