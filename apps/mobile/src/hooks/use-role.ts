import { useAuth } from "@/providers/auth-provider";
import type { UserRole } from "@propninja/types/permissions";

export function useRole(): UserRole {
  const { user } = useAuth();
  return user?.role ?? "agent";
}

export function useIsAgent() {
  return useRole() === "agent";
}

export function useIsManager() {
  const role = useRole();
  return role === "manager" || role === "admin";
}

export function useIsAdmin() {
  return useRole() === "admin";
}
