import * as Haptics from "expo-haptics";

export function hapticLight() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function hapticMedium() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function hapticSuccess() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function hapticError() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
