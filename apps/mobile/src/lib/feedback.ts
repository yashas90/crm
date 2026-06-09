import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/** Light success feedback after saving a call log (iOS haptic; no-op on Android for now). */
export async function feedbackCallSaved() {
  if (Platform.OS === "ios") {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Haptics unavailable on some simulators — ignore
    }
  }
}
