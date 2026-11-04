import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "@/lib/api";

export type RoleName = "MR" | "RISK_OFFICER" | "RISK_OWNER";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: RoleName;
  permissions: string[];
  branch: { id: string; code: string; name: string } | null;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (...permissions: string[]) => boolean;
  refetchUser: () => void;
}

const AuthCtx = createContext<AuthState | null>(null);

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const res = await api.get("/auth/me");
    return res.data.user ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!meQuery.isSuccess) return;
    setUser(meQuery.data ?? null);
    setIsLoading(false);
  }, [meQuery.data, meQuery.isSuccess]);

  useEffect(() => {
    if (meQuery.isError) {
      setUser(null);
      setIsLoading(false);
    }
  }, [meQuery.isError]);

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const res = await api.post("/auth/login", { username, password });
        setUser(res.data.user);
        queryClient.clear();
      } catch (err) {
        throw new Error(getErrorMessage(err));
      }
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // abaikan error logout
    }
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const can = useCallback(
    (...permissions: string[]) => {
      if (!user) return false;
      if (user.role === "MR") return true;
      return permissions.some((p) => user.permissions.includes(p));
    },
    [user],
  );

  const refetchUser = useCallback(() => {
    void fetchMe().then((found) => {
      setUser(found);
      setIsLoading(false);
    });
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, logout, can, refetchUser }),
    [user, isLoading, login, logout, can, refetchUser],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
