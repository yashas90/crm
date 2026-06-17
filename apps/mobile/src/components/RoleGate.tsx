import { AccessDenied } from "@/components/ui/AccessDenied";
import { useRole } from "@/hooks/use-role";
import type { UserRole } from "@propninja/types";
import type { ReactNode } from "react";

type RoleGateProps = {
  roles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
  onGoBack?: () => void;
};

export function RoleGate({ roles, children, fallback, onGoBack }: RoleGateProps) {
  const role = useRole();
  if (!roles.includes(role)) {
    return fallback ?? <AccessDenied onGoBack={onGoBack} />;
  }
  return children;
}
