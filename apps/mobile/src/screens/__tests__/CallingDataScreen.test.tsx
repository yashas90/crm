import { apiGet } from "@/lib/apiClient";
import {
  callingListRestoreOffset,
  isCallingListQueryKey,
  mergeCallingRows,
} from "@/lib/callingQueueList";
import { dialPhoneNumber } from "@/lib/phoneActions";
import { CallingDataScreen } from "@/screens/CallingDataScreen";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { FlatList } from "react-native";

jest.mock("@react-native-community/datetimepicker", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { __esModule: true, default: () => React.createElement(View, null) };
});

jest.mock("@/lib/apiClient", () => ({
  apiGet: jest.fn(),
  apiPost: jest.fn(),
}));

jest.mock("@/lib/phoneActions", () => ({
  dialPhoneNumber: jest.fn().mockResolvedValue(true),
}));

const mockApiGet = apiGet as jest.MockedFunction<typeof apiGet>;
const mockDial = dialPhoneNumber as jest.MockedFunction<typeof dialPhoneNumber>;

const contacts = [
  {
    recordId: "rec-1",
    name: "Asha Rao",
    phone: "+919800000001",
    city: "Bangalore",
    budget: "80L",
    propertyType: "apartment",
    bedrooms: "2",
    status: "pending",
    callAttempts: 0,
    assignedAt: "2026-10-15T04:00:00.000Z",
    callbackScheduledAt: null,
  },
  {
    recordId: "rec-2",
    name: "Contact Two",
    phone: "+919800000002",
    city: "Mumbai",
    budget: null,
    propertyType: null,
    bedrooms: null,
    status: "retry",
    callAttempts: 1,
    assignedAt: "2026-10-15T03:00:00.000Z",
    callbackScheduledAt: null,
  },
];

function renderCallingData() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...render(<CallingDataScreen {...({} as never)} />, { wrapper }) };
}

function listFetchCount() {
  return mockApiGet.mock.calls.filter(([path]) => {
    const url = String(path);
    return url.includes("/api/agent/calling-data") && !url.includes("/stats");
  }).length;
}

describe("calling queue stability", () => {
  it("keeps the current order when a payload arrives shuffled", () => {
    const previous = [{ recordId: "a" }, { recordId: "b" }, { recordId: "c" }];
    const incoming = [previous[2], previous[0], { recordId: "d" }];
    expect(mergeCallingRows(previous, incoming).map((row) => row.recordId)).toEqual([
      "a",
      "c",
      "d",
    ]);
  });

  it("does not scroll the list during a call or back to the top", () => {
    expect(callingListRestoreOffset(true, 480)).toBeNull();
    expect(callingListRestoreOffset(false, 0)).toBeNull();
    expect(callingListRestoreOffset(false, 480)).toBe(480);
  });

  it("treats only the calling queue as off-limits for a reconnect refetch", () => {
    expect(isCallingListQueryKey(["calling-data", ""])).toBe(true);
    expect(isCallingListQueryKey(["calling-daily-status"])).toBe(true);
    expect(isCallingListQueryKey(["calling-stats"])).toBe(false);
    expect(isCallingListQueryKey(["morning-brief"])).toBe(false);
    expect(isCallingListQueryKey(["leads"])).toBe(false);
  });
});

describe("CallingDataScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    mockApiGet.mockImplementation(async (path: string) => {
      if (path.includes("/api/agent/daily-status")) {
        return {
          contactsRequestedToday: 10,
          maxDailyLimit: 100,
          remaining: 90,
          paused: false,
          resetsAt: "2026-10-16T00:00:00.000Z",
        };
      }
      if (path.includes("/api/agent/calling-data/stats")) {
        return { remaining: 2, pending: 1, retry: 1, callbacks: 0 };
      }
      return contacts;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not tick a countdown while the agent still has calling quota", async () => {
    jest.useFakeTimers();
    renderCallingData();

    await waitFor(() => {
      expect(screen.getByText("Asha Rao")).toBeTruthy();
    });
    expect(screen.getByText("Contact Two")).toBeTruthy();
    expect(screen.queryByText(/Daily limit reached/)).toBeNull();

    const list = screen.UNSAFE_getByType(FlatList);
    const data = list.props.data;
    const extraData = list.props.extraData;
    const header = list.props.ListHeaderComponent;
    const scrollToOffset = jest.spyOn(FlatList.prototype, "scrollToOffset");

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    const after = screen.UNSAFE_getByType(FlatList);
    expect(screen.queryByText(/Daily limit reached/)).toBeNull();
    expect(after.props.data).toBe(data);
    expect(after.props.extraData).toBe(extraData);
    expect(after.props.ListHeaderComponent).toBe(header);
    expect(after.props.removeClippedSubviews).toBe(false);
    expect(scrollToOffset).not.toHaveBeenCalled();
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("Contact Two")).toBeTruthy();
    expect(mockDial).not.toHaveBeenCalled();
    scrollToOffset.mockRestore();
  });

  it("dials only the contact the agent taps", async () => {
    renderCallingData();
    await waitFor(() => {
      expect(screen.getByText("Asha Rao")).toBeTruthy();
    });

    fireEvent.press(screen.getAllByText("Call")[0]);
    expect(mockDial).toHaveBeenCalledTimes(1);
    expect(mockDial).toHaveBeenCalledWith("+919800000001");
  });

  it("keeps the contact list mounted while the daily-limit countdown ticks", async () => {
    mockApiGet.mockImplementation(async (path: string) => {
      if (path.includes("/api/agent/daily-status")) {
        return {
          contactsRequestedToday: 100,
          maxDailyLimit: 100,
          remaining: 0,
          paused: false,
          resetsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        };
      }
      if (path.includes("/api/agent/calling-data/stats")) {
        return { remaining: 2, pending: 1, retry: 1, callbacks: 0 };
      }
      return contacts;
    });

    jest.useFakeTimers();
    renderCallingData();

    await waitFor(() => {
      expect(screen.getByText("Asha Rao")).toBeTruthy();
      expect(screen.getByText(/Daily limit reached/)).toBeTruthy();
    });

    const before = screen.getByText(/Daily limit reached/).props.children;
    const list = screen.UNSAFE_getByType(FlatList);
    const data = list.props.data;
    const extraData = list.props.extraData;
    const scrollToOffset = jest.spyOn(FlatList.prototype, "scrollToOffset");
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    const after = screen.getByText(/Daily limit reached/).props.children;
    const again = screen.UNSAFE_getByType(FlatList);

    expect(after).not.toEqual(before);
    expect(again.props.data).toBe(data);
    expect(again.props.extraData).toBe(extraData);
    expect(again.props.removeClippedSubviews).toBe(false);
    expect(scrollToOffset).not.toHaveBeenCalled();
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("Contact Two")).toBeTruthy();
    expect(mockDial).not.toHaveBeenCalled();
    scrollToOffset.mockRestore();
  });

  it("does not refetch, reorder, or scroll while a call is in progress", async () => {
    const scrollToOffset = jest
      .spyOn(FlatList.prototype, "scrollToOffset")
      .mockImplementation(() => {});
    const scrollToIndex = jest
      .spyOn(FlatList.prototype, "scrollToIndex")
      .mockImplementation(() => {});
    const { client } = renderCallingData();

    await waitFor(() => {
      expect(screen.getByText("Asha Rao")).toBeTruthy();
    });

    const queue = client.getQueryCache().findAll({ queryKey: ["calling-data"] })[0];
    expect(queue?.options.refetchOnWindowFocus).toBe(false);
    expect(queue?.options.refetchOnReconnect).toBe(false);
    expect(queue?.options.staleTime).toBe("static");

    const beforeFetches = listFetchCount();
    fireEvent.press(screen.getAllByText("Call")[0]);
    const pinned = screen.UNSAFE_getByType(FlatList).props.data;
    expect(pinned.map((row: { recordId: string }) => row.recordId)).toEqual(["rec-1", "rec-2"]);
    scrollToOffset.mockClear();
    scrollToIndex.mockClear();

    mockApiGet.mockImplementation(async (path: string) => {
      if (path.includes("/api/agent/daily-status")) {
        return {
          contactsRequestedToday: 10,
          maxDailyLimit: 100,
          remaining: 90,
          paused: false,
          resetsAt: "2026-10-16T00:00:00.000Z",
        };
      }
      if (path.includes("/api/agent/calling-data/stats")) {
        return { remaining: 9, pending: 9, retry: 9, callbacks: 9 };
      }
      return [...contacts].reverse();
    });

    await act(async () => {
      client.setQueryData(["calling-data", ""], [...contacts].reverse());
      focusManager.setFocused(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(false);
      onlineManager.setOnline(true);
      await client.invalidateQueries({ refetchType: "active" });
    });

    const list = screen.UNSAFE_getByType(FlatList);
    expect(list.props.data).toBe(pinned);
    expect(list.props.data.map((row: { name: string }) => row.name)).toEqual([
      "Asha Rao",
      "Contact Two",
    ]);
    expect(list.props.refreshControl.props.refreshing).toBe(false);
    expect(list.props.removeClippedSubviews).toBe(false);
    expect(listFetchCount()).toBe(beforeFetches);
    expect(scrollToOffset).not.toHaveBeenCalled();
    expect(scrollToIndex).not.toHaveBeenCalled();
    expect(mockDial).toHaveBeenCalledTimes(1);
    scrollToOffset.mockRestore();
    scrollToIndex.mockRestore();
  });
});
