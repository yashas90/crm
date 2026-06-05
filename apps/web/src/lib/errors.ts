import { ApiRequestError } from "@/lib/apiClient";

function formatValidationDetails(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;

  const flattened = details as {
    fieldErrors?: Record<string, string[]>;
    formErrors?: string[];
  };

  const parts: string[] = [];
  if (flattened.formErrors?.length) {
    parts.push(...flattened.formErrors);
  }
  if (flattened.fieldErrors) {
    for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
      if (messages?.length) {
        parts.push(`${field}: ${messages.join(", ")}`);
      }
    }
  }

  return parts.length > 0 ? parts.join(". ") : null;
}

/** User-facing message for API, network, and unknown errors. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof ApiRequestError) {
    if (error.code === "NETWORK_ERROR") {
      return error.message;
    }
    if (error.code === "VALIDATION_ERROR") {
      const details = formatValidationDetails(error.details);
      if (details) return details;
    }
    if (error.code === "LEAD_DUPLICATE_PHONE") {
      return error.message;
    }
    if (error.message) return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
