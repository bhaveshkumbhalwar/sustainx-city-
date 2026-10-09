import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loginUser, registerUser, getMe, setToken, getToken } from '../services/api';

/* eslint-disable react-refresh/only-export-components, react-hooks/set-state-in-effect */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Session key — changes on every login, forces child components to remount
  const [sessionKey, setSessionKey] = useState(0);

  // Check for existing token on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      getMe()
        .then((res) => setUser(res.data.user))
        .catch(() => {
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password, role) => {
    const res = await loginUser({ email, password, role });
    setToken(res.data.token);
    setUser(res.data.user);
    // Increment session key to force all dashboard components to remount with fresh state
    setSessionKey((k) => k + 1);
    return res.data.user;
  }, []);

  const register = useCallback(async (data) => {
    const res = await registerUser(data);
    setToken(res.data.token);
    setUser(res.data.user);
    setSessionKey((k) => k + 1);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    // Increment session key so next login gets completely fresh components
    setSessionKey((k) => k + 1);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await getMe();
      setUser(res.data.user);
    } catch {
      // ignore
    }
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, sessionKey, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
