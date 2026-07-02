import { ApiRequestError } from "@/lib/apiClient";
import { isRateLimitError } from "@/lib/query-errors";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

function shouldSuppressGlobalQueryError(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return false;
  if (error.status === 403 || error.status === 404) return true;
  if (isRateLimitError(error)) return true;
  return error.code === "FORBIDDEN" || error.code === "NOT_FOUND";
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.suppressErrorToast) return;
      if (shouldSuppressGlobalQueryError(error)) return;
      const message = error instanceof Error ? error.message : "Something went wrong";
      Alert.alert("Could not load data", message);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
  },
});
