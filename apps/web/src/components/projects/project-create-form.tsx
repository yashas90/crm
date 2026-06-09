"use client";

import { useCreateProject } from "@/hooks/use-projects";
import { getErrorMessage } from "@/lib/errors";
import { Button } from "@propninja/ui/button";
import { Input } from "@propninja/ui/input";
import { Label } from "@propninja/ui/label";
import { useState } from "react";

type ProjectCreateFormProps = {
  onSuccess?: () => void;
};

export function ProjectCreateForm({ onSuccess }: ProjectCreateFormProps) {
  const createProject = useCreateProject();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    createProject.mutate(
      {
        name,
        projectType: "residential",
        category: "residential",
        description: description || undefined,
      },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          setError(null);
          onSuccess?.();
        },
        onError: (err) => {
          setError(getErrorMessage(err, "Failed to create project"));
        },
      },
    );
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="project-name">Project name</Label>
        <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="project-description">Description</Label>
        <Input
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes about this project"
        />
      </div>
      {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={createProject.isPending}>
          {createProject.isPending ? "Creating..." : "Create project"}
        </Button>
      </div>
    </form>
  );
}
