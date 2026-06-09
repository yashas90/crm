"use client";

import { Button } from "@propninja/ui/button";

type ProjectWizardFooterProps = {
  readOnly?: boolean;
  isSaving?: boolean;
  saveLabel?: string;
  onCancel: () => void;
  onSave: () => void;
};

export function ProjectWizardFooter({
  readOnly = false,
  isSaving = false,
  saveLabel = "Save and Go To Next",
  onCancel,
  onSave,
}: ProjectWizardFooterProps) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancel
      </Button>
      {!readOnly ? (
        <Button type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving..." : saveLabel}
        </Button>
      ) : null}
    </div>
  );
}
