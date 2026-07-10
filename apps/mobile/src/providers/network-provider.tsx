import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { setNetworkOnline } from "@/lib/networkState";
import { flushOfflineQueue } from "@/lib/offlineQueue";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/providers/toast-provider";
import NetInfo from "@react-native-community/netinfo";
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type NetworkContextValue = {
  isOnline: boolean;
};

const NetworkContext = createContext<NetworkContextValue>({ isOnline: true });

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const { showToast } = useToast();
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false;
      setIsOnline(online);
      setNetworkOnline(online);

      if (!online) {
        wasOffline.current = true;
        return;
      }

      if (wasOffline.current) {
        wasOffline.current = false;
        void queryClient.resumePausedMutations();
        void queryClient.invalidateQueries();
        void flushOfflineQueue().then((synced) => {
          if (synced > 0) {
            showToast(`Synced ${synced} pending call log${synced === 1 ? "" : "s"}`);
          }
        });
      }
    });

    void NetInfo.fetch().then((state) => {
      const online = state.isConnected !== false;
      setIsOnline(online);
      setNetworkOnline(online);
    });

    return unsubscribe;
  }, [showToast]);

  const value = useMemo(() => ({ isOnline }), [isOnline]);

  return (
    <NetworkContext.Provider value={value}>
      {children}
      <OfflineBanner visible={!isOnline} />
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
