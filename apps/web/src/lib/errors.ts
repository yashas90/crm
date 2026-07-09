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
    if (error.code === "UNAUTHORIZED") {
      return "Your session expired. Please sign in again.";
    }
    if (error.code === "FORBIDDEN") {
      return "You do not have permission to perform this action.";
    }
    if (error.code === "NOT_FOUND") {
      if (error.message === "Route not found") {
        return "API endpoint not found. Try signing out and back in, or contact support if this continues.";
      }
      return error.message || "The requested item was not found.";
    }
    if (error.code === "RATE_LIMITED" || error.code === "IP_BLOCKED") {
      return error.message || "Too many requests. Please wait and try again.";
    }
    if (error.code === "INTERNAL_ERROR") {
      return error.message && error.message !== "Something went wrong"
        ? error.message
        : "Something went wrong. Please refresh the page or try again.";
    }
    if (error.code === "VALIDATION_ERROR") {
      const details = formatValidationDetails(error.details);
      if (details) return details;
    }
    if (error.code === "LEAD_DUPLICATE_PHONE") {
      return error.message;
    }
    if (error.code === "EMAIL_IN_USE") {
      return error.message;
    }
    if (error.message && error.message !== "Something went wrong") {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
