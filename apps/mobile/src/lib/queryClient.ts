import { QueryCache, QueryClient } from "@tanstack/react-query";
import { Alert } from "react-native";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.suppressErrorToast) return;
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
