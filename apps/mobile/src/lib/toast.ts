let showToastFn: ((message: string) => void) | null = null;

export function registerGlobalToast(handler: (message: string) => void) {
  showToastFn = handler;
}

export function showGlobalToast(message: string) {
  showToastFn?.(message);
}
