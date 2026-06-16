"use client";

import { ProjectWizard } from "@/components/projects/project-wizard";
import { PROJECT_GALLERY_ENABLED, parseWizardStep } from "@/lib/project-wizard";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

type EditProjectPageProps = {
  params: { id: string };
};

export default function EditProjectPage({ params }: EditProjectPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const readOnly = searchParams.get("view") === "1";
  const initialStep = parseWizardStep(searchParams.get("step"));

  useEffect(() => {
    if (PROJECT_GALLERY_ENABLED || searchParams.get("step") !== "gallery") return;

    const query = new URLSearchParams(searchParams.toString());
    query.set("step", "amenities");
    router.replace(`/projects/${params.id}?${query.toString()}`);
  }, [params.id, router, searchParams]);

  return (
    <ProjectWizard
      mode="edit"
      projectId={params.id}
      readOnly={readOnly}
      initialStep={initialStep}
    />
  );
}
