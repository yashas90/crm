import {
  type SessionUser,
  clearAuth,
  getUser,
  isAuthenticated,
  loadAuth,
  setAuth as persistAuth,
} from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { setUnauthorizedHandler } from "@/lib/apiClient";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  status: AuthStatus;
  user: SessionUser | null;
  login: (token: string, user: SessionUser) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    void loadAuth()
      .then(() => {
        setUser(getUser());
        setStatus(isAuthenticated() ? "authenticated" : "unauthenticated");
      })
      .catch(() => setStatus("unauthenticated"));
  }, []);

  const login = useCallback(async (token: string, sessionUser: SessionUser) => {
    await persistAuth(token, sessionUser);
    setUser(sessionUser);
    setStatus("authenticated");
    await queryClient.invalidateQueries();
  }, []);

  const logout = useCallback(async () => {
    await clearAuth();
    setUser(null);
    setStatus("unauthenticated");
    queryClient.clear();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
