import { apiPost } from "@/lib/apiClient";
import { useAuth } from "@/providers/auth-provider";
import { LoginScreen } from "@/screens/LoginScreen";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

jest.mock("@/lib/apiClient", () => ({
  apiPost: jest.fn(),
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: jest.fn(),
}));

const mockApiPost = apiPost as jest.MockedFunction<typeof apiPost>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      status: "unauthenticated",
      user: null,
      login: jest.fn().mockResolvedValue(undefined),
      logout: jest.fn(),
    });
  });

  it("renders sign-in form", () => {
    render(<LoginScreen />);

    expect(screen.getByText("PropNinja")).toBeTruthy();
    expect(screen.getAllByText("Sign in").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByPlaceholderText("you@company.com")).toBeTruthy();
    expect(screen.getByPlaceholderText("••••••••")).toBeTruthy();
  });

  it("submits credentials and calls login on success", async () => {
    const login = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      status: "unauthenticated",
      user: null,
      login,
      logout: jest.fn(),
    });

    mockApiPost.mockResolvedValue({
      token: "test-token",
      user: {
        id: "user-1",
        email: "agent@demo.test",
        name: "Agent One",
        role: "agent",
      },
    });

    render(<LoginScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("you@company.com"), "agent@demo.test");
    fireEvent.changeText(screen.getByPlaceholderText("••••••••"), "secret");
    const signInActions = screen.getAllByText("Sign in");
    fireEvent.press(signInActions[signInActions.length - 1]!);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith("/api/auth/login", {
        email: "agent@demo.test",
        password: "secret",
      });
    });

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("test-token", {
        id: "user-1",
        email: "agent@demo.test",
        name: "Agent One",
        role: "agent",
      });
    });
  });
});
