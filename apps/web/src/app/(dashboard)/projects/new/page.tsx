"use client";

import { ProjectWizard } from "@/components/projects/project-wizard";

/** Create flow skips gallery until uploads are implemented (see PROJECT_GALLERY_ENABLED). */
export default function NewProjectPage() {
  return <ProjectWizard mode="create" />;
}
