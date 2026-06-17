"use client";

import { ProjectWizard } from "@/components/projects/project-wizard";
import { PROJECT_GALLERY_ENABLED, parseWizardStep } from "@/lib/project-wizard";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function EditProjectPageContent() {
  const { id } = useParams<{ id: string }>();
  const projectId = id ?? "";
  const searchParams = useSearchParams();
  const router = useRouter();
  const readOnly = searchParams.get("view") === "1";
  const initialStep = parseWizardStep(searchParams.get("step"));

  useEffect(() => {
    if (PROJECT_GALLERY_ENABLED || searchParams.get("step") !== "gallery") return;

    const query = new URLSearchParams(searchParams.toString());
    query.set("step", "amenities");
    router.replace(`/projects/${projectId}?${query.toString()}`);
  }, [projectId, router, searchParams]);

  return (
    <ProjectWizard
      mode="edit"
      projectId={projectId}
      readOnly={readOnly}
      initialStep={initialStep}
    />
  );
}

export default function EditProjectPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">Loading project…</p>}>
      <EditProjectPageContent />
    </Suspense>
  );
}
