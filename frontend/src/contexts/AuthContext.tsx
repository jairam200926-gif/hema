import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiGet, getStoredToken, setStoredToken } from '../api/client';
import { Role } from '../types';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  isActive?: boolean;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function getValidInitialToken(): string | null {
  const activeToken = getStoredToken();
  if (!activeToken) return null;
  const payload = parseJwtPayload(activeToken);
  if (payload && payload.exp && payload.exp * 1000 < Date.now()) {
    setStoredToken(null);
    return null;
  }
  return activeToken;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(getValidInitialToken);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchUserProfile = async () => {
    try {
      const profile = await apiGet<any>('/auth/me');
      if (profile && profile.id) {
        setUser({
          id: String(profile.id),
          username: profile.username,
          email: profile.email,
          role: profile.role as Role,
          isActive: profile.is_active,
        });
      }
    } catch {
      // If fetching /me fails (e.g. token expired), fallback to token claims or clear
      const rawToken = getStoredToken();
      if (rawToken) {
        const payload = parseJwtPayload(rawToken);
        if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
          setUser({
            id: payload.sub,
            username: payload.sub?.slice(0, 8) || 'Operator',
            email: 'operator@vaultguard.internal',
            role: (payload.role || 'USER') as Role,
          });
          return;
        }
      }
      setStoredToken(null);
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUserProfile().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (newToken: string) => {
    setStoredToken(newToken);
    setToken(newToken);
    await fetchUserProfile();
  };

  const logout = () => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchUserProfile();
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
