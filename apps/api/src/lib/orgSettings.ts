import type { UpdateOrgBody } from "./validators/org.js";

/** Keys inside `organizations.settings` that PATCH /api/org may change. */
export const EDITABLE_ORG_SETTING_KEYS = [
  "website",
  "timezone",
  "locale",
  "dateFormat",
  "currency",
  "leadScoringEnabled",
] as const;

export type EditableOrgSettingKey = (typeof EDITABLE_ORG_SETTING_KEYS)[number];

export function buildOrgSettingsPatch(
  body: UpdateOrgBody,
): Partial<Record<EditableOrgSettingKey, unknown>> {
  const patch: Partial<Record<EditableOrgSettingKey, unknown>> = {};

  if (body.settings) {
    for (const key of EDITABLE_ORG_SETTING_KEYS) {
      if (key in body.settings) {
        patch[key] = body.settings[key as keyof typeof body.settings];
      }
    }
  }

  if (body.website !== undefined) {
    patch.website = body.website;
  }
  if (body.timezone !== undefined) {
    patch.timezone = body.timezone;
  }

  return patch;
}

export function mergeOrgSettings(
  current: Record<string, unknown> | null | undefined,
  patch: Partial<Record<EditableOrgSettingKey, unknown>>,
): Record<string, unknown> {
  const next = { ...(current ?? {}) };

  for (const [key, value] of Object.entries(patch)) {
    if (key === "leadScoringEnabled") {
      if (value === false || value === "false") {
        next.leadScoringEnabled = false;
      } else if (value === true || value === "true") {
        next.leadScoringEnabled = true;
      }
      continue;
    }
    if (value === null || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
  }

  return next;
}
