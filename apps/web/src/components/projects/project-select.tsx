"use client";

import { useProjects } from "@/hooks/use-projects";
import { cn } from "@propninja/ui/lib/utils";

type ProjectSelectProps = {
  id?: string;
  value: string;
  onChange: (projectId: string) => void;
  className?: string;
  disabled?: boolean;
};

export function ProjectSelect({ id, value, onChange, className, disabled }: ProjectSelectProps) {
  const { data: projects, isLoading } = useProjects({ availability: true });

  return (
    <select
      id={id}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        className,
      )}
      value={value}
      disabled={disabled || isLoading}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{isLoading ? "Loading projects..." : "— No project —"}</option>
      {projects?.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
          {` (${project.projectCategory})`}
        </option>
      ))}
    </select>
  );
}
