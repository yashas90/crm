import { ApiRequestError } from "@/lib/apiClient";
import { isRateLimitError, isTransientQueryError } from "@/lib/query-errors";
import { queryRetryCount, queryRetryDelay } from "@/lib/queryRetry";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

function shouldSuppressGlobalQueryError(error: unknown): boolean {
  if (!(error instanceof ApiRequestError)) return false;
  if (error.status === 401) return true; // auth system handles session expiry
  if (error.status === 403 || error.status === 404) return true;
  if (isRateLimitError(error)) return true;
  if (isTransientQueryError(error)) return true;
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
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: queryRetryCount,
      retryDelay: queryRetryDelay,
      refetchOnReconnect: true,
      refetchOnMount: true,
      networkMode: "always",
    },
    mutations: {
      retry: 0,
    },
  },
});
