import { getUser, refreshCurrentUser } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

/** Current user from cache, refreshed via GET /api/auth/me when possible. */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const refreshed = await refreshCurrentUser();
      return refreshed ?? getUser();
    },
    initialData: () => getUser() ?? undefined,
    staleTime: 60_000,
  });
}
