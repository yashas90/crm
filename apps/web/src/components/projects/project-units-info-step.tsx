"use client";

import { ProjectWizardFooter } from "@/components/projects/project-wizard-footer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProjectDetail } from "@/hooks/use-projects";
import { useUpdateProject } from "@/hooks/use-projects";
import { getErrorMessage } from "@/lib/errors";
import {
  DEFAULT_UNITS_INFO,
  type ProjectUnitTypeRow,
  type ProjectUnitsInfo,
  normalizeUnitsInfo,
} from "@/lib/project-wizard-types";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ProjectUnitsInfoStepProps = {
  project: ProjectDetail;
  readOnly?: boolean;
  onSaved?: () => void;
};

export function ProjectUnitsInfoStep({
  project,
  readOnly = false,
  onSaved,
}: ProjectUnitsInfoStepProps) {
  const router = useRouter();
  const updateProject = useUpdateProject();
  const [units, setUnits] = useState<ProjectUnitTypeRow[]>(DEFAULT_UNITS_INFO.units);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUnits(normalizeUnitsInfo(project.unitsInfo).units);
  }, [project.unitsInfo]);

  function updateUnit(index: number, patch: Partial<ProjectUnitTypeRow>) {
    setUnits((current) =>
      current.map((unit, unitIndex) => (unitIndex === index ? { ...unit, ...patch } : unit)),
    );
  }

  function addUnit() {
    setUnits((current) => [
      ...current,
      { type: "", count: 0, carpetArea: "", minPrice: undefined, maxPrice: undefined },
    ]);
  }

  function removeUnit(index: number) {
    setUnits((current) => current.filter((_, unitIndex) => unitIndex !== index));
  }

  function handleSave() {
    setError(null);
    const payload: ProjectUnitsInfo = {
      units: units
        .filter((unit) => unit.type.trim())
        .map((unit) => ({
          type: unit.type.trim(),
          count: Number(unit.count) || 0,
          carpetArea: unit.carpetArea?.trim() || undefined,
          minPrice: unit.minPrice != null ? Number(unit.minPrice) : undefined,
          maxPrice: unit.maxPrice != null ? Number(unit.maxPrice) : undefined,
        })),
    };

    updateProject.mutate(
      { projectId: project.id, payload: { unitsInfo: payload } },
      {
        onSuccess: () => onSaved?.(),
        onError: (err) => setError(getErrorMessage(err, "Failed to save units info")),
      },
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200/80 bg-card p-5 shadow-sm dark:border-white/10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Unit Types</h2>
            <p className="text-sm text-muted-foreground">
              Describe unit mix, carpet area, and indicative price ranges.
            </p>
          </div>
          {!readOnly ? (
            <Button type="button" variant="outline" size="sm" onClick={addUnit}>
              <Plus className="mr-2 h-4 w-4" />
              Add row
            </Button>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit Type</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Carpet Area</TableHead>
                <TableHead>Min Price (INR)</TableHead>
                <TableHead>Max Price (INR)</TableHead>
                {!readOnly ? <TableHead className="w-12" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.map((unit, index) => (
                <TableRow key={`unit-${index}`}>
                  <TableCell>
                    <Input
                      value={unit.type}
                      disabled={readOnly}
                      placeholder="1BHK"
                      onChange={(event) => updateUnit(index, { type: event.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={unit.count}
                      disabled={readOnly}
                      onChange={(event) =>
                        updateUnit(index, { count: Number(event.target.value) || 0 })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={unit.carpetArea ?? ""}
                      disabled={readOnly}
                      placeholder="sq.ft."
                      onChange={(event) => updateUnit(index, { carpetArea: event.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={unit.minPrice ?? ""}
                      disabled={readOnly}
                      onChange={(event) =>
                        updateUnit(index, {
                          minPrice: event.target.value ? Number(event.target.value) : undefined,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={unit.maxPrice ?? ""}
                      disabled={readOnly}
                      onChange={(event) =>
                        updateUnit(index, {
                          maxPrice: event.target.value ? Number(event.target.value) : undefined,
                        })
                      }
                    />
                  </TableCell>
                  {!readOnly ? (
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={units.length <= 1}
                        onClick={() => removeUnit(index)}
                        aria-label="Remove unit row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
