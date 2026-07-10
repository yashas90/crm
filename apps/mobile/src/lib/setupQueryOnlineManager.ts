import { setNetworkOnline } from "@/lib/networkState";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { Platform } from "react-native";

let subscribed = false;

/** Sync React Query online state with device connectivity. */
export function setupQueryOnlineManager() {
  if (subscribed || Platform.OS === "web") return;
  subscribed = true;

  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false;
      setNetworkOnline(online);
      setOnline(online);
    });
  });

  void NetInfo.fetch().then((state) => {
    const online = state.isConnected !== false;
    setNetworkOnline(online);
    onlineManager.setOnline(online);
  });
}
