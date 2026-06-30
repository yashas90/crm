import { beforeEach } from "vitest";
import { resetLoginBruteForceForTests } from "../lib/loginBruteForce.js";
import {
  refreshTokenBlocklistCache,
  stopTokenBlocklistRefreshForTests,
} from "../lib/tokenBlocklist.js";
import { resetSecurityMonitoringState } from "../middleware/securityMonitoring.js";

beforeEach(async () => {
  resetLoginBruteForceForTests();
  resetSecurityMonitoringState();
  stopTokenBlocklistRefreshForTests();
  await refreshTokenBlocklistCache();
});
