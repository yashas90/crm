"use client";

import { ProjectWizard } from "@/components/projects/project-wizard";
import { parseWizardStep } from "@/lib/project-wizard";
import { useSearchParams } from "next/navigation";

type EditProjectPageProps = {
  params: { id: string };
};

export default function EditProjectPage({ params }: EditProjectPageProps) {
  const searchParams = useSearchParams();
  const readOnly = searchParams.get("view") === "1";
  const initialStep = parseWizardStep(searchParams.get("step"));

  return (
    <ProjectWizard
      mode="edit"
      projectId={params.id}
      readOnly={readOnly}
      initialStep={initialStep}
    />
  );
}
