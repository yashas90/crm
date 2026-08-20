import NetInfo from "@react-native-community/netinfo";
import { registerRootComponent } from "expo";
// Background location task must register before JS is suspended — keep this eager.
import "@/lib/locationTracking";
import App from "./App";

// Reachability against our API (Google probe is blocked/slow on many Indian carriers).
// Configure before any NetInfo listeners; keep work minimal at module load.
NetInfo.configure({
  reachabilityUrl: "https://crm-production-e81d.up.railway.app/health",
  reachabilityTest: (response) => Promise.resolve(response.status >= 200 && response.status < 500),
  reachabilityLongTimeout: 60_000,
  reachabilityShortTimeout: 5_000,
  reachabilityRequestTimeout: 15_000,
});

registerRootComponent(App);
