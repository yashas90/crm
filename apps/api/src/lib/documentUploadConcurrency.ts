const MAX_CONCURRENT_UPLOADS_PER_USER = 5;

const activeUploadsByUser = new Map<string, number>();

export function acquireUploadSlot(userId: string): boolean {
  const current = activeUploadsByUser.get(userId) ?? 0;
  if (current >= MAX_CONCURRENT_UPLOADS_PER_USER) {
    return false;
  }
  activeUploadsByUser.set(userId, current + 1);
  return true;
}

export function releaseUploadSlot(userId: string): void {
  const current = activeUploadsByUser.get(userId) ?? 0;
  if (current <= 1) {
    activeUploadsByUser.delete(userId);
    return;
  }
  activeUploadsByUser.set(userId, current - 1);
}

export { MAX_CONCURRENT_UPLOADS_PER_USER };
