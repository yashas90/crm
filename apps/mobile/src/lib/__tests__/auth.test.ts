jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@/lib/jwt", () => ({
  isTokenExpired: jest.fn(),
}));

const mockRefreshAccessToken = jest.fn();
const mockApiGet = jest.fn();
const mockInvalidateSession = jest.fn();

jest.mock("@/lib/apiClient", () => {
  class MockApiRequestError extends Error {
    code: string;
    status?: number;
    constructor(code: string, message: string, _details?: unknown, status?: number) {
      super(message);
      this.name = "ApiRequestError";
      this.code = code;
      this.status = status;
    }
  }

  return {
    ApiRequestError: MockApiRequestError,
    apiGet: (...args: unknown[]) => mockApiGet(...args),
    runWithSessionLogoutSuppressed: (fn: () => Promise<unknown>) => fn(),
    refreshAccessToken: () => mockRefreshAccessToken(),
    invalidateSession: () => mockInvalidateSession(),
  };
});

import { ApiRequestError } from "@/lib/apiClient";
import { clearAuth, refreshCurrentUser, setAuth } from "@/lib/auth";
import { isTokenExpired } from "@/lib/jwt";
import * as SecureStore from "expo-secure-store";

const mockIsTokenExpired = isTokenExpired as jest.MockedFunction<typeof isTokenExpired>;

describe("refreshCurrentUser", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await clearAuth();
    mockIsTokenExpired.mockReturnValue(false);
    mockRefreshAccessToken.mockResolvedValue(true);
    mockApiGet.mockResolvedValue({
      id: "u1",
      email: "agent@test.com",
      name: "Agent",
      role: "agent",
    });
  });

  it("refreshes an expired access token instead of clearing the session", async () => {
    await setAuth(
      "expired-token",
      { id: "u1", email: "a@t.com", name: "A", role: "agent" },
      "rt-1",
    );
    mockIsTokenExpired.mockReturnValue(true);

    const user = await refreshCurrentUser();

    expect(mockRefreshAccessToken).toHaveBeenCalled();
    expect(mockInvalidateSession).not.toHaveBeenCalled();
    expect(user?.email).toBe("agent@test.com");
  });

  it("keeps the session when refresh fails due to network", async () => {
    await setAuth(
      "expired-token",
      { id: "u1", email: "a@t.com", name: "A", role: "agent" },
      "rt-1",
    );
    mockIsTokenExpired.mockReturnValue(true);
    mockRefreshAccessToken.mockRejectedValue(
      new ApiRequestError("NETWORK_ERROR", "Cannot reach the server"),
    );

    const user = await refreshCurrentUser();

    expect(mockInvalidateSession).not.toHaveBeenCalled();
    expect(user?.email).toBe("a@t.com");
  });

  it("invalidates the session when refresh token is rejected", async () => {
    await setAuth(
      "expired-token",
      { id: "u1", email: "a@t.com", name: "A", role: "agent" },
      "rt-1",
    );
    mockIsTokenExpired.mockReturnValue(true);
    mockRefreshAccessToken.mockResolvedValue(false);

    const user = await refreshCurrentUser();

    expect(mockInvalidateSession).toHaveBeenCalled();
    expect(user).toBeNull();
  });
});
