jest.mock("@/lib/callLogNative", () => ({
  waitForOutgoingCallTalkSeconds: jest.fn(),
  getOutgoingCallTalkSeconds: jest.fn(),
}));

jest.mock("@/hooks/useCallDurationTracking", () => ({
  useCallDurationTracking: jest.fn(({ onReturn }: { onReturn: (info: unknown) => void }) => ({
    beginCall: jest.fn(),
    clearCallSession: jest.fn(),
    __onReturn: onReturn,
  })),
}));

import { useAutoDialerCallLog } from "@/hooks/useAutoDialerCallLog";
import { useCallDurationTracking } from "@/hooks/useCallDurationTracking";
import { waitForOutgoingCallTalkSeconds } from "@/lib/callLogNative";
import { act, renderHook, waitFor } from "@testing-library/react-native";

describe("useAutoDialerCallLog auto-record", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (waitForOutgoingCallTalkSeconds as jest.Mock).mockResolvedValue(12);
  });

  function startDial(logCall: jest.Mock) {
    const { result } = renderHook(() => useAutoDialerCallLog({ logCall }));
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
    return { result, tracking };
  }

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
    (waitForOutgoingCallTalkSeconds as jest.Mock).mockResolvedValue(0);
    const logCall = jest.fn().mockResolvedValue({ ok: true });
    const { tracking } = startDial(logCall);

    act(() => {
      tracking.__onReturn({
        calledAt: new Date(Date.now() - 20_000).toISOString(),
        durationMinutes: 0,
      });
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

  it("does not treat dial-to-return ring time as answered when OS talk time is missing", async () => {
    (waitForOutgoingCallTalkSeconds as jest.Mock).mockResolvedValue(null);
    const logCall = jest.fn().mockResolvedValue({ ok: true });
    const { tracking } = startDial(logCall);

    act(() => {
      tracking.__onReturn({
        calledAt: new Date(Date.now() - 45_000).toISOString(),
        durationMinutes: 1,
      });
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
