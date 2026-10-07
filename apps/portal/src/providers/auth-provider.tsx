import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { authApi, registerApiAuthHandlers, type AuthResponse } from "@/lib/api";
import {
  clearStoredAuth,
  getStoredAuth,
  setStoredAuth,
} from "@/lib/auth-storage";
import { connectSocket } from "@/lib/socket";
import {
  dashboardPathForRole,
  portalFromRole,
  type Portal,
} from "@/lib/portal";
import { safeRedirectPath } from "@/lib/safe-redirect";

type AuthContextValue = {
  auth: AuthResponse | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    portal: Portal,
    redirectTo?: string,
  ) => Promise<void>;
  logout: (redirectTo?: string) => void;
  setSession: (session: AuthResponse) => void;
  getToken: () => string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [auth, setAuth] = useState<AuthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredAuth();
    // A brand session saved before brand sign-in was closed — drop it
    // rather than opening pages the API will refuse.
    if (stored?.user.role === "brand") {
      clearStoredAuth();
      setAuth(null);
    } else {
      setAuth(stored);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    registerApiAuthHandlers({
      getRefreshToken: () => getStoredAuth()?.tokens.refreshToken ?? null,
      onSessionRefreshed: (session) => {
        setStoredAuth(session);
        setAuth(session);
        connectSocket(session.tokens.accessToken);
      },
      onSessionExpired: () => {
        clearStoredAuth();
        setAuth(null);
        navigate("/login", { replace: true });
      },
    });
  }, [navigate]);

  const persist = useCallback((next: AuthResponse) => {
    setStoredAuth(next);
    setAuth(next);
  }, []);

  const login = useCallback(
    async (
      email: string,
      password: string,
      portal: Portal,
      redirectTo?: string,
    ) => {
      const res = await authApi.login(portal, { email, password });
      persist(res);
      const defaultPath = dashboardPathForRole(res.user.role);
      navigate(safeRedirectPath(redirectTo ?? defaultPath), { replace: true });
    },
    [persist, navigate],
  );

  const logout = useCallback(
    (redirectTo?: string) => {
      const refresh = auth?.tokens.refreshToken;
      if (refresh) {
        void fetch(
          `${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/auth/logout`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: refresh }),
          },
        ).catch(() => undefined);
      }
      clearStoredAuth();
      setAuth(null);
      navigate(safeRedirectPath(redirectTo ?? "/login"), { replace: true });
    },
    [auth, navigate],
  );

  const value = useMemo(
    () => ({
      auth,
      isLoading,
      login,
      logout,
      setSession: persist,
      getToken: () => auth?.tokens.accessToken ?? null,
    }),
    [auth, isLoading, login, logout, persist],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function usePortalRole(): Portal | null {
  const { auth } = useAuth();
  if (!auth) return null;
  return portalFromRole(auth.user.role);
}
