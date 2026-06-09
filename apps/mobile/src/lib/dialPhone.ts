import { Alert, Linking } from "react-native";

/**
 * Opens the native phone dialer via tel: URL.
 * Works on both iOS and Android (SIM / cellular dialer — no VoIP).
 */
export async function dialPhoneNumber(phone: string): Promise<boolean> {
  const normalized = phone.trim();
  if (!normalized) return false;

  const url = `tel:${normalized}`;
  const supported = await Linking.canOpenURL(url);
  if (!supported) {
    Alert.alert("Unavailable", "Phone dialer is not available on this device.");
    return false;
  }

  await Linking.openURL(url);
  return true;
}
