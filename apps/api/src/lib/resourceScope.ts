import type { AuthUser } from "../middleware/auth.js";
import { assertBelongsToOrg } from "./orgScope.js";

type TaskLike = {
  orgId: string;
  assignedTo: string | null;
};

export function canAccessTask(user: AuthUser, task: TaskLike): boolean {
  if (task.orgId !== user.orgId) return false;
  if (user.role === "admin" || user.role === "manager") return true;
  return task.assignedTo === user.id;
}

export function assertTaskAccess(user: AuthUser, task: TaskLike): void {
  assertBelongsToOrg(task.orgId, user);
  if (!canAccessTask(user, task)) {
    throw new Error("TASK_ACCESS_DENIED");
  }
}

type CallLike = {
  orgId: string;
  userId: string;
};

export function canAccessCall(user: AuthUser, call: CallLike): boolean {
  if (call.orgId !== user.orgId) return false;
  if (user.role === "admin" || user.role === "manager") return true;
  return call.userId === user.id;
}

type DocumentLike = {
  orgId: string;
};

export function assertDocumentOrgAccess(user: AuthUser, document: DocumentLike): void {
  assertBelongsToOrg(document.orgId, user);
}
