"use client";

import type { ProjectDetail } from "@/hooks/use-projects";
import { useCreateProject, useUpdateProject } from "@/hooks/use-projects";
import { getErrorMessage } from "@/lib/errors";
import {
  FACING_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  type ProjectBasicDetailsFormValues,
  basicDetailsToCreatePayload,
  basicDetailsToUpdatePayload,
  defaultBasicDetailsValues,
  parseReraInput,
  projectBasicDetailsSchema,
  projectToBasicDetailsForm,
} from "@/lib/project-basic-details-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { cn } from "@propninja/ui/lib/utils";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const textareaClass =
  "flex min-h-[6rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type ProjectBasicDetailsFormProps = {
  mode: "create" | "edit";
  project?: ProjectDetail;
  readOnly?: boolean;
  onCreateSuccess?: (projectId: string) => void;
  onSaveAndNext?: () => void;
};

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function ProjectBasicDetailsForm({
  mode,
  project,
  readOnly = false,
  onCreateSuccess,
  onSaveAndNext,
}: ProjectBasicDetailsFormProps) {
  const router = useRouter();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reraDraft, setReraDraft] = useState("");

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProjectBasicDetailsFormValues>({
    resolver: zodResolver(projectBasicDetailsSchema),
    defaultValues: defaultBasicDetailsValues,
  });

  const reraNumbers = watch("reraNumbers");

  useEffect(() => {
    if (project) {
      reset(projectToBasicDetailsForm(project));
    }
  }, [project, reset]);

  const isSaving = isSubmitting || createProject.isPending || updateProject.isPending;

  function addReraNumbers() {
    const parsed = parseReraInput(reraDraft);
    if (parsed.length === 0) return;
    const merged = [...new Set([...reraNumbers, ...parsed])];
    setValue("reraNumbers", merged, { shouldDirty: true });
    setReraDraft("");
  }

  function removeReraNumber(value: string) {
    setValue(
      "reraNumbers",
      reraNumbers.filter((item) => item !== value),
      { shouldDirty: true },
    );
  }

  function onSubmit(values: ProjectBasicDetailsFormValues) {
    setSubmitError(null);

    if (mode === "create") {
      createProject.mutate(basicDetailsToCreatePayload(values), {
        onSuccess: (created) => {
          if (onCreateSuccess) {
            onCreateSuccess(created.id);
          } else {
            router.push(`/projects/${created.id}`);
          }
        },
        onError: (error) => {
          setSubmitError(getErrorMessage(error, "Failed to create project"));
        },
      });
      return;
    }

    if (!project) return;

    updateProject.mutate(
      {
        projectId: project.id,
        payload: basicDetailsToUpdatePayload(values),
      },
      {
        onSuccess: () => onSaveAndNext?.(),
        onError: (error) => {
          setSubmitError(getErrorMessage(error, "Failed to save project"));
        },
      },
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormSection title="Project Details">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="project-name">
              Project Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="project-name"
              disabled={readOnly}
              {...register("name")}
              placeholder="Enter project name"
            />
            <FieldError message={errors.name?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-type">
              Project Type <span className="text-destructive">*</span>
            </Label>
            <select
              id="project-type"
              className={selectClass}
              disabled={readOnly}
              {...register("projectType")}
            >
              {PROJECT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldError message={errors.projectType?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-sub-type">Project Sub-Type</Label>
            <Input
              id="project-sub-type"
              disabled={readOnly}
              {...register("subType")}
              placeholder="Plot, Apartment, Villa..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-status">
              Status <span className="text-destructive">*</span>
            </Label>
            <select
              id="project-status"
              className={selectClass}
              disabled={readOnly}
              {...register("status")}
            >
              {PROJECT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldError message={errors.status?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="land-area">Land Area</Label>
            <Input
              id="land-area"
              disabled={readOnly}
              {...register("landArea")}
              placeholder="e.g. 5 acres, 12000 sq.ft."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="certificate">Certificate</Label>
            <Input
              id="certificate"
              disabled={readOnly}
              {...register("certificate")}
              placeholder="Certificate number or reference"
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Facing">
        <Controller
          name="facing"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {FACING_OPTIONS.map((option) => {
                const selected = field.value.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={readOnly}
                    onClick={() => {
                      if (readOnly) return;
                      field.onChange(
                        selected
                          ? field.value.filter((value) => value !== option.value)
                          : [...field.value, option.value],
                      );
                    }}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-foreground hover:bg-muted",
                      readOnly && "cursor-not-allowed opacity-60",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        />
      </FormSection>

      <FormSection title="Description">
        <textarea
          className={textareaClass}
          disabled={readOnly}
          {...register("description")}
          placeholder="Project description"
        />
      </FormSection>

      <FormSection title="Notes">
        <textarea
          className={textareaClass}
          disabled={readOnly}
          {...register("notes")}
          placeholder="Internal notes"
        />
      </FormSection>

      <FormSection title="Builder Details">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="builder-name">Builder / Developer Name</Label>
            <Input
              id="builder-name"
              disabled={readOnly}
              {...register("builderName")}
              placeholder="Builder or developer name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="builder-phone">Builder Contact Number</Label>
            <Input
              id="builder-phone"
              disabled={readOnly}
              {...register("builderPhone")}
              placeholder="Builder contact number"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="builder-contact-name">Point of Contact Name</Label>
            <Input
              id="builder-contact-name"
              disabled={readOnly}
              {...register("builderContactName")}
              placeholder="Contact person name"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="builder-contact-phone">Point of Contact Phone</Label>
            <Input
              id="builder-contact-phone"
              disabled={readOnly}
              {...register("builderContactPhone")}
              placeholder="Contact person phone"
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="RERA Details">
        <div className="space-y-3">
          <Label htmlFor="rera-numbers">RERA Registration Numbers</Label>
          {!readOnly ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="rera-numbers"
                value={reraDraft}
                onChange={(event) => setReraDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addReraNumbers();
                  }
                }}
                placeholder="Enter numbers, comma-separated"
              />
              <Button type="button" variant="outline" onClick={addReraNumbers}>
                Add
              </Button>
            </div>
          ) : null}
          {reraNumbers.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {reraNumbers.map((number) => (
                <li
                  key={number}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"
                >
                  <span>{number}</span>
                  {!readOnly ? (
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-background"
                      onClick={() => removeReraNumber(number)}
                      aria-label={`Remove ${number}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No RERA numbers added yet.</p>
          )}
        </div>
      </FormSection>

      <FormSection title="Price">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="min-price">Min Price (INR)</Label>
            <Input
              id="min-price"
              type="number"
              min={0}
              step="0.01"
              disabled={readOnly}
              {...register("minPrice")}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-price">Max Price (INR)</Label>
            <Input
              id="max-price"
              type="number"
              min={0}
              step="0.01"
              disabled={readOnly}
              {...register("maxPrice")}
              placeholder="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="brokerage-percent">Brokerage Amount (%)</Label>
            <Input
              id="brokerage-percent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              disabled={readOnly}
              {...register("brokeragePercent")}
              placeholder="0"
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Dates">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input id="start-date" type="date" disabled={readOnly} {...register("startDate")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">End Date</Label>
            <Input id="end-date" type="date" disabled={readOnly} {...register("endDate")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="possession-date">Possession Date</Label>
            <Input
              id="possession-date"
              type="date"
              disabled={readOnly}
              {...register("possessionDate")}
            />
          </div>
        </div>
      </FormSection>

      {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/projects")}>
          Cancel
        </Button>
        {!readOnly ? (
          <Button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save and Go To Next"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
