import { beforeEach } from "vitest";
import { resetLoginBruteForceForTests } from "../lib/loginBruteForce.js";
import { resetSecurityMonitoringState } from "../middleware/securityMonitoring.js";

beforeEach(() => {
  resetLoginBruteForceForTests();
  resetSecurityMonitoringState();
});
