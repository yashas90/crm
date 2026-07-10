import NetInfo from "@react-native-community/netinfo";
import { registerRootComponent } from "expo";
import App from "./App";

// Use our own API for reachability checks — default Google URL is blocked/slow on Indian carriers
NetInfo.configure({
  reachabilityUrl: "https://crm-production-e81d.up.railway.app/api/health",
  reachabilityTest: (response) => Promise.resolve(response.status < 500),
  reachabilityLongTimeout: 60_000,
  reachabilityShortTimeout: 5_000,
  reachabilityRequestTimeout: 15_000,
});

registerRootComponent(App);
