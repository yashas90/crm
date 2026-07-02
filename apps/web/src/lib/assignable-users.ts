import type { UserRow } from "@/hooks/use-users";

type SessionLike = {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export function sessionAsAssignableUser(session: SessionLike): UserRow {
  const email = session.email ?? "";
  return {
    id: session.id,
    username: email || session.id,
    name: session.name?.trim() || "You",
    email,
    firstName: null,
    lastName: null,
    workEmail: null,
    workPhone: null,
    personalPhone: null,
    homeLocation: null,
    department: null,
    designation: null,
    timeZone: null,
    brokerNumber: null,
    description: null,
    roleLabel: null,
    generalManagerId: null,
    reportingToId: null,
    role: session.role ?? "agent",
    phone: null,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

export function mergeAssignableUsers(users: UserRow[] | undefined, session: SessionLike | null) {
  const items = [...(users ?? [])];
  if (session?.id && !items.some((user) => user.id === session.id)) {
    items.unshift(sessionAsAssignableUser(session));
  }
  return items.length > 0 ? items : session?.id ? [sessionAsAssignableUser(session)] : [];
}
