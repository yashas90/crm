"use client";

import { ProjectWizardFooter } from "@/components/projects/project-wizard-footer";
import type { ProjectDetail } from "@/hooks/use-projects";
import { useUpdateProject } from "@/hooks/use-projects";
import { getErrorMessage } from "@/lib/errors";
import { type ProjectBlocksInfo, normalizeBlocksInfo } from "@/lib/project-wizard-types";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const textareaClass =
  "flex min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type ProjectBlocksInfoStepProps = {
  project: ProjectDetail;
  readOnly?: boolean;
  onSaved?: () => void;
};

export function ProjectBlocksInfoStep({
  project,
  readOnly = false,
  onSaved,
}: ProjectBlocksInfoStepProps) {
  const router = useRouter();
  const updateProject = useUpdateProject();
  const [form, setForm] = useState<ProjectBlocksInfo>(normalizeBlocksInfo(null));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(normalizeBlocksInfo(project.blocksInfo));
  }, [project.blocksInfo]);

  function handleSave() {
    setError(null);
    const payload: ProjectBlocksInfo = {
      numberOfBlocks: form.numberOfBlocks ? Number(form.numberOfBlocks) : undefined,
      floorsPerBlock: form.floorsPerBlock ? Number(form.floorsPerBlock) : undefined,
      unitsPerFloor: form.unitsPerFloor ? Number(form.unitsPerFloor) : undefined,
      notes: form.notes?.trim() || undefined,
    };

    updateProject.mutate(
      { projectId: project.id, payload: { blocksInfo: payload } },
      {
        onSuccess: () => onSaved?.(),
        onError: (err) => setError(getErrorMessage(err, "Failed to save blocks info")),
      },
    );
  }

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-xl border border-slate-200/80 bg-card p-5 shadow-sm dark:border-white/10">
        <div>
          <h2 className="text-base font-semibold">Blocks Overview</h2>
          <p className="text-sm text-muted-foreground">
            High-level block and floor configuration for the project.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="number-of-blocks">Number of Blocks</Label>
            <Input
              id="number-of-blocks"
              type="number"
              min={0}
              disabled={readOnly}
              value={form.numberOfBlocks ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  numberOfBlocks: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="floors-per-block">Floors per Block</Label>
            <Input
              id="floors-per-block"
              type="number"
              min={0}
              disabled={readOnly}
              value={form.floorsPerBlock ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  floorsPerBlock: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="units-per-floor">Units per Floor</Label>
            <Input
              id="units-per-floor"
              type="number"
              min={0}
              disabled={readOnly}
              value={form.unitsPerFloor ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  unitsPerFloor: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="blocks-notes">Notes</Label>
          <textarea
            id="blocks-notes"
            className={textareaClass}
            disabled={readOnly}
            value={form.notes ?? ""}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            placeholder="Tower names, wing details, etc."
          />
        </div>
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <ProjectWizardFooter
        readOnly={readOnly}
        isSaving={updateProject.isPending}
        onCancel={() => router.push("/projects")}
        onSave={handleSave}
      />
    </div>
  );
}
