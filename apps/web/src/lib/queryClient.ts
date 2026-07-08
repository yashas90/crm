import { getErrorMessage } from "@/lib/errors";
import { isForbiddenError, isRateLimitError } from "@/lib/query-errors";
import { QueryCache, QueryClient } from "@tanstack/react-query";

const recentErrorToasts = new Map<string, number>();
const ERROR_TOAST_DEDUPE_MS = 10_000;

function showErrorToast(message: string) {
  if (typeof window === "undefined") return;

  const now = Date.now();
  const lastShown = recentErrorToasts.get(message);
  if (lastShown !== undefined && now - lastShown < ERROR_TOAST_DEDUPE_MS) {
    return;
  }
  recentErrorToasts.set(message, now);

  void import("@/lib/toast").then(({ toast }) => toast.error(message));
}

function queryErrorFallback(query: { meta?: Record<string, unknown> }) {
  const context = query.meta?.errorContext;
  if (typeof context === "string" && context.length > 0) {
    return `Could not load ${context}`;
  }
  return "Failed to load data";
}

export function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.suppressErrorToast) return;
        if (isForbiddenError(error)) return;
        if (isRateLimitError(error)) return;
        // Background refetch failures already have cached data — avoid toast spam.
        if (query.state.data !== undefined) return;
        showErrorToast(getErrorMessage(error, queryErrorFallback(query)));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: 1,
        refetchIntervalInBackground: false,
      },
      mutations: {
        onError: (error, _variables, _context, mutation) => {
          if (mutation.meta?.suppressErrorToast) return;
          showErrorToast(getErrorMessage(error));
        },
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}
