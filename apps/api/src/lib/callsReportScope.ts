export type CallsReportViewer = {
  id: string;
  role: "admin" | "manager" | "agent";
};

export type CallsReportUserScope = {
  userId?: string;
  userIds?: string[];
};

export type ResolveCallsReportUserScopeInput = CallsReportUserScope & {
  viewer: CallsReportViewer;
  canViewAllReports: boolean;
  teamUserIds: string[];
};

/**
 * Agents always see themselves. Managers without org-wide report access are limited
 * to themselves plus users who report to them (or list them as general manager).
 * Admins / view_all keep the requested user filter (or org-wide when omitted).
 */
export function resolveCallsReportUserScope(
  input: ResolveCallsReportUserScopeInput,
): CallsReportUserScope | { forbidden: string } {
  const { viewer, canViewAllReports } = input;
  const requested = uniqueIds(
    input.userIds?.length ? input.userIds : input.userId ? [input.userId] : [],
  );

  if (viewer.role === "agent") {
    return { userId: undefined, userIds: [viewer.id] };
  }

  if (canViewAllReports) {
    if (requested.length === 0) {
      return { userId: input.userId, userIds: input.userIds };
    }
    return { userId: undefined, userIds: requested };
  }

  const teamIds = uniqueIds(input.teamUserIds.length > 0 ? input.teamUserIds : [viewer.id]);
  const teamSet = new Set(teamIds);

  if (requested.length === 0) {
    return { userId: undefined, userIds: teamIds };
  }

  const allowed = requested.filter((id) => teamSet.has(id));
  if (allowed.length === 0) {
    return { forbidden: "User filter is outside your team" };
  }

  return { userId: undefined, userIds: allowed };
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids)];
}
