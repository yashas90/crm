export const PROJECT_WIZARD_STEPS = [
  { id: "basic", label: "Basic Details" },
  { id: "units", label: "Units Info" },
  { id: "blocks", label: "Blocks Info" },
  { id: "amenities", label: "Amenities" },
  { id: "gallery", label: "Gallery" },
] as const;

export type ProjectWizardStepId = (typeof PROJECT_WIZARD_STEPS)[number]["id"];

export const PROJECT_WIZARD_STEP_ORDER: ProjectWizardStepId[] = [
  "basic",
  "units",
  "blocks",
  "amenities",
  "gallery",
];

export function parseWizardStep(value: string | null): ProjectWizardStepId {
  if (value && PROJECT_WIZARD_STEP_ORDER.includes(value as ProjectWizardStepId)) {
    return value as ProjectWizardStepId;
  }
  return "basic";
}

export function nextWizardStep(current: ProjectWizardStepId): ProjectWizardStepId | null {
  const index = PROJECT_WIZARD_STEP_ORDER.indexOf(current);
  if (index < 0 || index >= PROJECT_WIZARD_STEP_ORDER.length - 1) return null;
  return PROJECT_WIZARD_STEP_ORDER[index + 1] ?? null;
}

export function isWizardStepEnabled(stepId: ProjectWizardStepId, hasProjectId: boolean) {
  return stepId === "basic" || hasProjectId;
}
