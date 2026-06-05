import { getErrorMessage } from "@/lib/errors";
import { isForbiddenError } from "@/lib/query-errors";
import { QueryCache, QueryClient } from "@tanstack/react-query";

function showErrorToast(message: string) {
  if (typeof window === "undefined") return;
  void import("@/lib/toast").then(({ toast }) => toast.error(message));
}

export function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.suppressErrorToast) return;
        if (isForbiddenError(error)) return;
        showErrorToast(getErrorMessage(error, "Failed to load data"));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
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
