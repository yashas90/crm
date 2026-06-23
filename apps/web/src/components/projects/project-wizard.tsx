"use client";

import { EmptyState } from "@/components/common/empty-state";
import { ProjectAmenitiesStep } from "@/components/projects/project-amenities-step";
import { ProjectBasicDetailsForm } from "@/components/projects/project-basic-details-form";
import { ProjectBlocksInfoStep } from "@/components/projects/project-blocks-info-step";
import { ProjectGalleryStep } from "@/components/projects/project-gallery-step";
import { ProjectInventoryStep } from "@/components/projects/project-inventory-step";
import { ProjectUnitsInfoStep } from "@/components/projects/project-units-info-step";
import { ProjectWizardSteps } from "@/components/projects/project-wizard-steps";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/hooks/use-projects";
import { type ProjectWizardStepId, nextWizardStep } from "@/lib/project-wizard";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ProjectWizardProps = {
  mode: "create" | "edit";
  projectId?: string;
  readOnly?: boolean;
  initialStep?: ProjectWizardStepId;
};

export function ProjectWizard({
  mode,
  projectId,
  readOnly = false,
  initialStep = "basic",
}: ProjectWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<ProjectWizardStepId>(initialStep);
  const hasProjectId = mode === "edit" && Boolean(projectId);

  useEffect(() => {
    setCurrentStep(initialStep);
  }, [initialStep]);

  const projectQuery = useProject(projectId ?? "", {
    enabled: hasProjectId,
  });

  const title = mode === "create" ? "Add Project" : readOnly ? "View Project" : "Edit Project";

  const goToNextStep = useCallback(() => {
    const next = nextWizardStep(currentStep);
    if (next) {
      setCurrentStep(next);
      if (projectId) {
        router.replace(`/projects/${projectId}?step=${next}${readOnly ? "&view=1" : ""}`);
      }
    }
  }, [currentStep, projectId, readOnly, router]);

  const handleStepChange = useCallback(
    (step: ProjectWizardStepId) => {
      setCurrentStep(step);
      if (projectId) {
        router.replace(`/projects/${projectId}?step=${step}${readOnly ? "&view=1" : ""}`);
      }
    },
    [projectId, readOnly, router],
  );

  const handleCreateSuccess = useCallback(
    (createdId: string) => {
      router.push(`/projects/${createdId}?step=units`);
    },
    [router],
  );

  function renderStepContent() {
    if (currentStep === "basic") {
      if (mode === "edit") {
        if (projectQuery.isLoading) return <WizardSkeleton />;
        if (projectQuery.isError || !projectQuery.data) {
          return (
            <EmptyState
              title="Unable to load project"
              description="This project could not be loaded. It may have been deleted or you may not have access."
              icon={<AlertCircle className="h-7 w-7 text-destructive" />}
            />
          );
        }
        return (
          <ProjectBasicDetailsForm
            mode="edit"
            project={projectQuery.data}
            readOnly={readOnly}
            onSaveAndNext={goToNextStep}
          />
        );
      }
      return (
        <ProjectBasicDetailsForm
          mode="create"
          readOnly={readOnly}
          onCreateSuccess={handleCreateSuccess}
        />
      );
    }

    if (!hasProjectId || projectQuery.isLoading) {
      return <WizardSkeleton />;
    }

    if (projectQuery.isError || !projectQuery.data) {
      return (
        <EmptyState
          title="Unable to load project"
          description="This project could not be loaded. It may have been deleted or you may not have access."
          icon={<AlertCircle className="h-7 w-7 text-destructive" />}
        />
      );
    }

    const project = projectQuery.data;

    switch (currentStep) {
      case "units":
        return (
          <ProjectUnitsInfoStep project={project} readOnly={readOnly} onSaved={goToNextStep} />
        );
      case "blocks":
        return (
          <ProjectBlocksInfoStep project={project} readOnly={readOnly} onSaved={goToNextStep} />
        );
      case "inventory":
        return <ProjectInventoryStep projectId={project.id} readOnly={readOnly} />;
      case "amenities":
        return (
          <ProjectAmenitiesStep project={project} readOnly={readOnly} onSaved={goToNextStep} />
        );
      case "gallery":
        return <ProjectGalleryStep project={project} readOnly={readOnly} onSaved={goToNextStep} />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "create"
            ? "Create a new project and fill in details across wizard steps."
            : "Update project information across wizard steps."}
        </p>
      </div>

      <ProjectWizardSteps
        currentStep={currentStep}
        hasProjectId={hasProjectId}
        onStepChange={handleStepChange}
      />

      {renderStepContent()}
    </div>
  );
}

function WizardSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="space-y-3 border-2 border-black p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
