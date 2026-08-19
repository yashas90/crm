import { PRODUCTION_API_URL, getApiBaseUrl } from "@/lib/apiBaseUrl";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    appOwnership: null,
    executionEnvironment: "standalone",
    isDevice: true,
    expoConfig: {
      extra: {
        apiUrl: "https://crm-production-e81d.up.railway.app",
      },
    },
  },
}));

describe("getApiBaseUrl", () => {
  const originalDev = (global as { __DEV__?: boolean }).__DEV__;

  afterEach(() => {
    (global as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it("uses expo.extra.apiUrl in standalone debug (__DEV__) builds", () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    expect(getApiBaseUrl()).toBe(PRODUCTION_API_URL);
  });

  it("uses production in release builds", () => {
    (global as { __DEV__?: boolean }).__DEV__ = false;
    expect(getApiBaseUrl()).toBe(PRODUCTION_API_URL);
  });
});
