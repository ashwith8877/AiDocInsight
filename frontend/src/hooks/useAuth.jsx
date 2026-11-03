import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as authApi from '../services/authService';

const AuthContext = createContext(null);
const TOKEN_KEY = 'aidocinsight_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const persistSession = useCallback((nextToken, nextUser) => {
    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      if (!token) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await authApi.getMe();
        if (active) {
          setUser(response.data.user);
        }
      } catch {
        if (active) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    bootstrap();
    return () => {
      active = false;
    };
  }, [token]);

  const register = useCallback(
    async (formData) => {
      const response = await authApi.register(formData);
      persistSession(response.data.token, response.data.user);
      return response;
    },
    [persistSession]
  );

  const login = useCallback(
    async (formData) => {
      const response = await authApi.login(formData);
      persistSession(response.data.token, response.data.user);
      return response;
    },
    [persistSession]
  );

  const googleLogin = useCallback(
    async (idToken) => {
      const response = await authApi.googleLogin(idToken);
      persistSession(response.data.token, response.data.user);
      return response;
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    try {
      if (token) {
        await authApi.logout();
      }
    } catch {
      // Clear local session even if the API call fails.
    } finally {
      persistSession(null, null);
    }
  }, [persistSession, token]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(user && token),
      register,
      login,
      googleLogin,
      logout,
    }),
    [user, token, loading, register, login, googleLogin, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
