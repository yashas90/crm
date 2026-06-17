import {
  type CallLogItem,
  useCallLogsInfinite,
  useCallLogsSummaryBar,
} from "@/hooks/use-call-logs";
import { CallLogsScreen } from "@/screens/CallLogsScreen";
import { render, screen } from "@testing-library/react-native";

jest.mock("@/hooks/use-call-logs", () => ({
  ...jest.requireActual("@/hooks/use-call-logs"),
  useCallLogsInfinite: jest.fn(),
  useCallLogsSummaryBar: jest.fn(),
}));

jest.mock("@/hooks/use-role", () => ({
  useRole: jest.fn(() => "agent"),
  useIsManager: jest.fn(() => false),
  useIsAdmin: jest.fn(() => false),
  useIsAgent: jest.fn(() => true),
}));

const mockUseCallLogsInfinite = useCallLogsInfinite as jest.MockedFunction<
  typeof useCallLogsInfinite
>;
const mockUseCallLogsSummaryBar = useCallLogsSummaryBar as jest.MockedFunction<
  typeof useCallLogsSummaryBar
>;

const mockCalls: CallLogItem[] = [
  {
    id: "call-1",
    leadId: "lead-1",
    leadName: "Jane Doe",
    phone: "+919876543210",
    outcome: "answered",
    duration: 5,
    notes: "Interested in 2BHK",
    calledAt: "2026-06-16T10:00:00.000Z",
  },
  {
    id: "call-2",
    leadId: "lead-2",
    leadName: "John Smith",
    phone: "+919800000000",
    outcome: "no_answer",
    duration: 0,
    notes: null,
    calledAt: "2026-06-15T14:30:00.000Z",
  },
];

describe("CallLogsScreen", () => {
  beforeEach(() => {
    mockUseCallLogsSummaryBar.mockReturnValue({
      callsToday: 3,
      callsThisWeek: 12,
      answeredPercent: 67,
      isLoading: false,
      refetch: jest.fn(),
    });

    mockUseCallLogsInfinite.mockReturnValue({
      data: {
        pages: [{ calls: mockCalls, total: 2, page: 1, limit: 50 }],
        pageParams: [1],
      },
      isLoading: false,
      isError: false,
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      refetch: jest.fn(),
      fetchNextPage: jest.fn(),
    } as never);
  });

  it("renders summary bar, filters, and call log items", () => {
    render(
      <CallLogsScreen
        navigation={{ getParent: jest.fn(), goBack: jest.fn() } as never}
        route={{ key: "CallLogsScreen", name: "CallLogsScreen" }}
      />,
    );

    expect(screen.getByText("Calls today")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("This week")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("67%")).toBeTruthy();
    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expect(screen.getByText("John Smith")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.getAllByText("Answered").length).toBeGreaterThan(0);
  });
});
