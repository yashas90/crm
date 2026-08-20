import { InteractionManager } from "react-native";

/**
 * Run work after animations / first paint so startup stays responsive.
 * Falls back to a short timeout if interactions never settle.
 */
export function deferUntilIdle(task: () => void, fallbackMs = 500): () => void {
  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const run = () => {
    if (cancelled) return;
    task();
  };

  const handle = InteractionManager.runAfterInteractions(() => {
    if (timeoutId) clearTimeout(timeoutId);
    run();
  });

  timeoutId = setTimeout(() => {
    handle.cancel();
    run();
  }, fallbackMs);

  return () => {
    cancelled = true;
    handle.cancel();
    if (timeoutId) clearTimeout(timeoutId);
  };
}
