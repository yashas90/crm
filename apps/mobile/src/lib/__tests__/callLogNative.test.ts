import { getOutgoingCallTalkSeconds, waitForOutgoingCallTalkSeconds } from "@/lib/callLogNative";
import { NativeModules, Platform } from "react-native";

describe("getOutgoingCallTalkSeconds", () => {
  const originalOs = Platform.OS;

  afterEach(() => {
    // @ts-expect-error test override
    Platform.OS = originalOs;
    NativeModules.CallLogModule = undefined;
  });

  it("returns 0 when the OS recorded an unanswered outgoing call", async () => {
    // @ts-expect-error test override
    Platform.OS = "android";
    NativeModules.CallLogModule = {
      getLastCallDuration: jest.fn().mockResolvedValue(0),
    };

    await expect(getOutgoingCallTalkSeconds("9876543210", 1)).resolves.toBe(0);
  });

  it("returns null when no matching OS row exists", async () => {
    // @ts-expect-error test override
    Platform.OS = "android";
    NativeModules.CallLogModule = {
      getLastCallDuration: jest.fn().mockResolvedValue(null),
    };

    await expect(getOutgoingCallTalkSeconds("9876543210", 1)).resolves.toBeNull();
  });
});

describe("waitForOutgoingCallTalkSeconds", () => {
  const originalOs = Platform.OS;

  afterEach(() => {
    // @ts-expect-error test override
    Platform.OS = originalOs;
    NativeModules.CallLogModule = undefined;
    jest.useRealTimers();
  });

  it("retries a missing row and accepts a later 0-second talk time", async () => {
    jest.useFakeTimers();
    // @ts-expect-error test override
    Platform.OS = "android";
    const getLast = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(0);
    NativeModules.CallLogModule = { getLastCallDuration: getLast };

    const pending = waitForOutgoingCallTalkSeconds("9876543210", 1, [2000, 2500]);
    await jest.advanceTimersByTimeAsync(2000);
    await jest.advanceTimersByTimeAsync(2500);
    await expect(pending).resolves.toBe(0);
    expect(getLast).toHaveBeenCalledTimes(2);
  });
});
