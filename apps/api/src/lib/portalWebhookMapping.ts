import type { PortalFieldMapping } from "./portalWebhookDefaults.js";

export type MappedPortalLead = {
  name: string;
  phone: string;
  email?: string;
  message?: string;
  projectInterest?: string;
};

function readPayloadValue(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

export function applyPortalFieldMapping(
  body: Record<string, unknown>,
  mapping: PortalFieldMapping,
): MappedPortalLead {
  const mapped: MappedPortalLead = {
    name: readPayloadValue(body, mapping.name) ?? "",
    phone: readPayloadValue(body, mapping.phone) ?? "",
  };

  if (mapping.email) {
    const email = readPayloadValue(body, mapping.email);
    if (email) mapped.email = email;
  }
  if (mapping.message) {
    const message = readPayloadValue(body, mapping.message);
    if (message) mapped.message = message;
  }
  if (mapping.projectInterest) {
    const projectInterest = readPayloadValue(body, mapping.projectInterest);
    if (projectInterest) mapped.projectInterest = projectInterest;
  }

  return mapped;
}

export function splitFullName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { firstName: "Unknown", lastName: "" };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? "Unknown",
    lastName: parts.slice(1).join(" "),
  };
}
