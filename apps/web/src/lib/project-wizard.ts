/** Gallery uploads are enabled when R2 is configured on the API. */
export const PROJECT_GALLERY_ENABLED = true;

export const PROJECT_WIZARD_STEPS = [
  { id: "basic", label: "Basic Details" },
  { id: "units", label: "Units Info" },
  { id: "blocks", label: "Blocks Info" },
  { id: "inventory", label: "Inventory" },
  { id: "amenities", label: "Amenities" },
  { id: "gallery", label: "Photos & Gallery" },
  { id: "documents", label: "Brochures & Documents" },
] as const;

export type ProjectWizardStepId = (typeof PROJECT_WIZARD_STEPS)[number]["id"];

export const PROJECT_WIZARD_STEP_ORDER: ProjectWizardStepId[] = [
  "basic",
  "units",
  "blocks",
  "inventory",
  "amenities",
  "gallery",
  "documents",
];

export function activeWizardStepOrder(): ProjectWizardStepId[] {
  if (PROJECT_GALLERY_ENABLED) return [...PROJECT_WIZARD_STEP_ORDER];
  return PROJECT_WIZARD_STEP_ORDER.filter((step) => step !== "gallery");
}

export function visibleWizardSteps() {
  if (PROJECT_GALLERY_ENABLED) return [...PROJECT_WIZARD_STEPS];
  return PROJECT_WIZARD_STEPS.filter((step) => step.id !== "gallery");
}

export function parseWizardStep(value: string | null): ProjectWizardStepId {
  if (value && PROJECT_WIZARD_STEP_ORDER.includes(value as ProjectWizardStepId)) {
    const step = value as ProjectWizardStepId;
    if (!PROJECT_GALLERY_ENABLED && step === "gallery") {
      return "amenities";
    }
    return step;
  }
  return "basic";
}

export function nextWizardStep(current: ProjectWizardStepId): ProjectWizardStepId | null {
  const order = activeWizardStepOrder();
  const index = order.indexOf(current);
  if (index < 0 || index >= order.length - 1) return null;
  return order[index + 1] ?? null;
}

export function isWizardStepEnabled(stepId: ProjectWizardStepId, hasProjectId: boolean) {
  if (!PROJECT_GALLERY_ENABLED && stepId === "gallery") return false;
  return stepId === "basic" || hasProjectId;
}
