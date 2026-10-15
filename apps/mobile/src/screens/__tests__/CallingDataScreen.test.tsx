import { apiGet } from "@/lib/apiClient";
import { dialPhoneNumber } from "@/lib/phoneActions";
import { CallingDataScreen } from "@/screens/CallingDataScreen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

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
  return render(<CallingDataScreen {...({} as never)} />, { wrapper });
}

describe("CallingDataScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
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

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.queryByText(/Daily limit reached/)).toBeNull();
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("Contact Two")).toBeTruthy();
    expect(mockDial).not.toHaveBeenCalled();
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
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    const after = screen.getByText(/Daily limit reached/).props.children;

    expect(after).not.toEqual(before);
    expect(screen.getByText("Asha Rao")).toBeTruthy();
    expect(screen.getByText("Contact Two")).toBeTruthy();
    expect(mockDial).not.toHaveBeenCalled();
  });
});
