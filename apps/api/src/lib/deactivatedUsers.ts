/** In-process blocklist — deactivated users are rejected before JWT validation completes. */
const blockedUserIds = new Set<string>();

export function blockUser(userId: string): void {
  blockedUserIds.add(userId);
}

export function unblockUser(userId: string): void {
  blockedUserIds.delete(userId);
}

export function isUserBlocked(userId: string): boolean {
  return blockedUserIds.has(userId);
}

export function getBlockedUserIds(): ReadonlySet<string> {
  return blockedUserIds;
}

export { decodeJwtPayload, decodeJwtSubject } from "./jwtPayload.js";
