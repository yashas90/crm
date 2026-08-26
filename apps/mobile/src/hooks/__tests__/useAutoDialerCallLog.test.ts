jest.mock("@/lib/callLogNative", () => ({
  getOutgoingCallTalkSeconds: jest.fn(),
}));

jest.mock("@/hooks/useCallDurationTracking", () => ({
  useCallDurationTracking: jest.fn(({ onReturn }: { onReturn: (info: unknown) => void }) => ({
    beginCall: jest.fn(),
    clearCallSession: jest.fn(),
    // Expose onReturn for tests via module helper
    __onReturn: onReturn,
  })),
}));

import { useAutoDialerCallLog } from "@/hooks/useAutoDialerCallLog";
import { useCallDurationTracking } from "@/hooks/useCallDurationTracking";
import { getOutgoingCallTalkSeconds } from "@/lib/callLogNative";
import { act, renderHook, waitFor } from "@testing-library/react-native";

describe("useAutoDialerCallLog auto-record", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (getOutgoingCallTalkSeconds as jest.Mock).mockResolvedValue(12);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("automatically logs answered + talk seconds without agent confirm", async () => {
    const logCall = jest.fn().mockResolvedValue({ ok: true });
    const onLogged = jest.fn();

    const { result } = renderHook(() =>
      useAutoDialerCallLog({
        logCall,
        onLogged,
      }),
    );

    act(() => {
      result.current.beginCall({
        leadId: "lead-1",
        leadName: "Test",
        phoneNumber: "+918971558855",
      });
    });

    const tracking = (useCallDurationTracking as jest.Mock).mock.results.at(-1)?.value as {
      __onReturn: (info: { calledAt: string; durationMinutes: number }) => void;
    };

    act(() => {
      tracking.__onReturn({
        calledAt: new Date(Date.now() - 30_000).toISOString(),
        durationMinutes: 0,
      });
    });

    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });

    await waitFor(() => {
      expect(logCall).toHaveBeenCalled();
    });

    expect(logCall).toHaveBeenCalledWith(
      expect.objectContaining({
        lead_id: "lead-1",
        phone_number: "+918971558855",
        duration_seconds: 12,
        outcome: "answered",
        source: "mobile-auto",
      }),
    );
    expect(onLogged).toHaveBeenCalledWith(
      "answered",
      expect.objectContaining({
        leadId: "lead-1",
        durationSeconds: 12,
        outcome: "answered",
      }),
    );
    expect(result.current.autoLoggedCall?.outcome).toBe("answered");
    expect(result.current.isPendingLog).toBe(false);
    expect(result.current.pendingLog).toBeNull();
  });

  it("auto-logs no_answer when OS talk time is 0", async () => {
    (getOutgoingCallTalkSeconds as jest.Mock).mockResolvedValue(0);
    const logCall = jest.fn().mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useAutoDialerCallLog({ logCall }));

    act(() => {
      result.current.beginCall({
        leadId: "lead-2",
        leadName: "Test",
        phoneNumber: "+919999999999",
      });
    });

    const tracking = (useCallDurationTracking as jest.Mock).mock.results.at(-1)?.value as {
      __onReturn: (info: { calledAt: string; durationMinutes: number }) => void;
    };

    act(() => {
      tracking.__onReturn({
        calledAt: new Date(Date.now() - 20_000).toISOString(),
        durationMinutes: 0,
      });
    });

    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });

    await waitFor(() => expect(logCall).toHaveBeenCalled());

    expect(logCall).toHaveBeenCalledWith(
      expect.objectContaining({
        duration_seconds: 0,
        outcome: "no_answer",
        source: "mobile-auto",
      }),
    );
  });
});
