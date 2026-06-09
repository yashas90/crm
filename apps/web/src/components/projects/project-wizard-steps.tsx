"use client";

import {
  PROJECT_WIZARD_STEPS,
  type ProjectWizardStepId,
  isWizardStepEnabled,
} from "@/lib/project-wizard";
import { cn } from "@propninja/ui/lib/utils";

type ProjectWizardStepsProps = {
  currentStep: ProjectWizardStepId;
  hasProjectId: boolean;
  onStepChange?: (step: ProjectWizardStepId) => void;
};

export function ProjectWizardSteps({
  currentStep,
  hasProjectId,
  onStepChange,
}: ProjectWizardStepsProps) {
  return (
    <nav
      aria-label="Project wizard steps"
      className="overflow-x-auto rounded-lg border border-border/60 bg-muted/20 p-1"
    >
      <ol className="flex min-w-max items-center gap-1">
        {PROJECT_WIZARD_STEPS.map((step, index) => {
          const isActive = step.id === currentStep;
          const isDisabled = !isWizardStepEnabled(step.id, hasProjectId);

          return (
            <li key={step.id} className="flex items-center">
              {index > 0 ? (
                <span className="mx-1 hidden h-px w-6 bg-border sm:block" aria-hidden />
              ) : null}
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) onStepChange?.(step.id);
                }}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isDisabled
                      ? "cursor-not-allowed text-muted-foreground/60"
                      : "text-muted-foreground hover:bg-background hover:text-foreground",
                )}
                aria-current={isActive ? "step" : undefined}
                title={isDisabled ? "Save basic details first" : undefined}
              >
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
