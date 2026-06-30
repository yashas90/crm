import { apiPost, setUnauthorizedHandler } from "@/lib/apiClient";
import {
  type SessionUser,
  clearAuth,
  getUser,
  isAuthenticated,
  loadAuth,
  setAuth as persistAuth,
} from "@/lib/auth";
import { registerPushToken } from "@/lib/pushNotifications";
import { queryClient } from "@/lib/queryClient";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: SessionUser | null;
  login: (token: string, user: SessionUser, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);

  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    void loadAuth()
      .then(() => {
        setUser(getUser());
        setStatus(isAuthenticated() ? "authenticated" : "unauthenticated");
      })
      .catch(() => setStatus("unauthenticated"))
      .finally(() => setBootstrapped(true));
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    void registerPushToken();
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void registerPushToken();
      }
    });

    return () => sub.remove();
  }, [status]);

  const login = useCallback(
    async (token: string, sessionUser: SessionUser, refreshToken?: string) => {
      await persistAuth(token, sessionUser, refreshToken);
      setUser(sessionUser);
      setStatus("authenticated");
      await queryClient.invalidateQueries();
      void registerPushToken();
    },
    [],
  );

  const logout = useCallback(async () => {
    const refreshToken = (await import("@/lib/auth")).getRefreshToken();
    try {
      await apiPost("/api/auth/logout", refreshToken ? { refreshToken } : {});
    } catch {
      // Token revocation best-effort — proceed with local logout regardless
    }
    await clearAuth();
    setUser(null);
    setStatus("unauthenticated");
    queryClient.clear();
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    setUnauthorizedHandler(() => {
      void logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout, bootstrapped]);

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
