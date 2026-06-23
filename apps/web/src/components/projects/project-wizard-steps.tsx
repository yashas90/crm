"use client";

import {
  PROJECT_GALLERY_ENABLED,
  type ProjectWizardStepId,
  isWizardStepEnabled,
  visibleWizardSteps,
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
    <div className="space-y-2">
      <nav
        aria-label="Project wizard steps"
        className="overflow-x-auto rounded-xl border border-slate-200/80 bg-muted/20 p-1 dark:border-white/10"
      >
        <ol className="flex min-w-max items-center gap-1">
          {visibleWizardSteps().map((step, index) => {
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
                      ? "bg-primary text-primary-foreground shadow-[2px_2px_0_0_#000]"
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
      {!PROJECT_GALLERY_ENABLED ? (
        <p className="text-sm text-muted-foreground">Gallery uploads coming soon.</p>
      ) : null}
    </div>
  );
}
