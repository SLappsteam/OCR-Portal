import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginCredentials } from '../types/auth';
import { hasMinimumRole } from '../utils/roleUtils';
import { setAccessToken, setRefreshHandler, setSessionExpiredHandler } from '../api/client';
import {
  loginUser,
  logoutUser,
  refreshAccessToken,
  fetchCurrentUser,
} from '../api/authApi';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  checkMinimumRole: (role: string) => boolean;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setRefreshHandler(refreshAccessToken);
    setSessionExpiredHandler(() => {
      setAccessToken(null);
      setUser(null);
    });
  }, []);

  useEffect(() => {
    async function restoreSession() {
      try {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          const currentUser = await fetchCurrentUser();
          setUser(currentUser);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await loginUser(credentials);
    setAccessToken(response.accessToken);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const checkMinimumRole = useCallback(
    (role: string) => {
      if (!user) return false;
      return hasMinimumRole(user.role, role);
    },
    [user]
  );

  const refreshSession = useCallback(async () => {
    const currentUser = await fetchCurrentUser();
    setUser(currentUser);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    login,
    logout,
    checkMinimumRole,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
