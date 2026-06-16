import {
  type NotificationRow,
  useMarkNotificationsRead,
  useNotifications,
} from "@/hooks/use-notifications";
import { NotificationsScreen } from "@/screens/NotificationsScreen";
import { render, screen } from "@testing-library/react-native";

jest.mock("@/hooks/use-notifications", () => ({
  ...jest.requireActual("@/hooks/use-notifications"),
  useNotifications: jest.fn(),
  useMarkNotificationsRead: jest.fn(),
}));

const mockUseNotifications = useNotifications as jest.MockedFunction<typeof useNotifications>;
const mockUseMarkNotificationsRead = useMarkNotificationsRead as jest.MockedFunction<
  typeof useMarkNotificationsRead
>;

const mockItems: NotificationRow[] = [
  {
    id: "n-1",
    userId: "user-1",
    type: "lead_assigned",
    payload: { leadId: "lead-1", leadName: "Jane Doe", assignedBy: "Manager" },
    isRead: false,
    createdAt: "2026-06-01T10:00:00.000Z",
  },
  {
    id: "n-2",
    userId: "user-1",
    type: "followup_due",
    payload: { leadId: "lead-2", leadName: "John Smith" },
    isRead: true,
    createdAt: "2026-06-01T09:00:00.000Z",
  },
];

describe("NotificationsScreen", () => {
  beforeEach(() => {
    mockUseNotifications.mockReturnValue({
      data: { items: mockItems, unreadCount: 1 },
      isLoading: false,
      isError: false,
      isRefetching: false,
      refetch: jest.fn(),
    } as ReturnType<typeof useNotifications>);

    mockUseMarkNotificationsRead.mockReturnValue({
      mutateAsync: jest.fn(),
    } as unknown as ReturnType<typeof useMarkNotificationsRead>);
  });

  it("renders mocked notification items", () => {
    render(
      <NotificationsScreen
        navigation={{ navigate: jest.fn() } as never}
        route={{ key: "NotificationsTab", name: "NotificationsTab" }}
      />,
    );

    expect(screen.getByText("Notifications")).toBeTruthy();
    expect(screen.getByText("1 unread")).toBeTruthy();
    expect(screen.getByText("Lead assigned")).toBeTruthy();
    expect(screen.getByText("Manager assigned you Jane Doe")).toBeTruthy();
    expect(screen.getByText("Follow-up due for John Smith")).toBeTruthy();
  });
});
