import { focusManager } from "@tanstack/react-query";
import { AppState, type AppStateStatus, Platform } from "react-native";

let subscribed = false;

/** Pause React Query refetch intervals when the app is backgrounded. */
export function setupQueryFocusManager() {
  if (subscribed || Platform.OS === "web") return;
  subscribed = true;

  function onAppStateChange(status: AppStateStatus) {
    focusManager.setFocused(status === "active");
  }

  onAppStateChange(AppState.currentState);
  const sub = AppState.addEventListener("change", onAppStateChange);
  return () => sub.remove();
}
