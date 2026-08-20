jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/apiClient", () => ({
  apiPost: jest.fn(() => Promise.resolve({ ok: true })),
}));

jest.mock("@/lib/callLogNative", () => ({
  hasCallLogPermission: jest.fn(() => Promise.resolve(true)),
}));

import { apiPost } from "@/lib/apiClient";
import { getOsCallLogPermissionStatus, syncOsCallLogMetadata } from "@/lib/callLogSync";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

describe("getOsCallLogPermissionStatus", () => {
  it("returns UNAVAILABLE on iOS", () => {
    const original = Platform.OS;
    // @ts-expect-error test override
    Platform.OS = "ios";
    expect(getOsCallLogPermissionStatus(true)).toBe("UNAVAILABLE");
    // @ts-expect-error test override
    Platform.OS = original;
  });
});

describe("syncOsCallLogMetadata", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  });

  it("skips upload when OS call log is unavailable", async () => {
    const result = await syncOsCallLogMetadata();
    // Without native CallLogModule.getRecentCalls, status is UNAVAILABLE
    expect(result.status).toBe("UNAVAILABLE");
    expect(result.uploaded).toBe(0);
    expect(apiPost).not.toHaveBeenCalled();
  });
});
