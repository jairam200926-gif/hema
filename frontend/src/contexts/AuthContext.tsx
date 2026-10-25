import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

import {
  apiGet,
  getStoredToken,
  setStoredToken,
} from "../api/client";

import { Role } from "../types";

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

const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

/**
 * Decode JWT payload without assuming the token is valid.
 * This does not verify the token's signature.
 */
function parseJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    const base64Url = parts[1];
    const base64 = base64Url
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const paddedBase64 =
      base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    const binary = atob(paddedBase64);

    const bytes = Uint8Array.from(
      binary,
      (character) => character.charCodeAt(0)
    );

    const json = new TextDecoder().decode(bytes);

    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Check whether a token has a valid structure and is not expired.
 * Actual JWT signature validation must be performed by the backend.
 */
function isTokenUsable(token: string): boolean {
  const payload = parseJwtPayload(token);

  if (!payload) {
    return false;
  }

  if (
    typeof payload.exp === "number" &&
    payload.exp * 1000 <= Date.now()
  ) {
    return false;
  }

  return true;
}

function getValidInitialToken(): string | null {
  const storedToken = getStoredToken();

  if (!storedToken) {
    return null;
  }

  if (!isTokenUsable(storedToken)) {
    setStoredToken(null);
    return null;
  }

  return storedToken;
}

export const AuthProvider: React.FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [token, setToken] = useState<string | null>(
    getValidInitialToken
  );

  const [user, setUser] = useState<AuthUser | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Retrieve the current user's profile from the backend.
   */
  const fetchUserProfile = useCallback(async (): Promise<void> => {
    const activeToken = getStoredToken();

    if (!activeToken || !isTokenUsable(activeToken)) {
      setStoredToken(null);
      setToken(null);
      setUser(null);
      return;
    }

    try {
      const profile = await apiGet<any>("/auth/me", activeToken);

      if (!profile || profile.id == null) {
        throw new Error(
          "The backend returned an invalid user profile."
        );
      }

      setUser({
        id: String(profile.id),
        username: String(profile.username ?? ""),
        email: String(profile.email ?? ""),
        role: (profile.role ?? "USER") as Role,
        isActive: profile.is_active ?? profile.isActive,
      });
    } catch (error) {
      console.error("Failed to load VaultGuard user profile:", error);

      /*
       * Do not automatically log the user out for every network error.
       * The backend might be temporarily unavailable.
       *
       * If a valid token exists, retain the session temporarily.
       * The backend remains responsible for authenticating requests.
       */
      const payload = parseJwtPayload(activeToken);

      if (payload && isTokenUsable(activeToken)) {
        setUser({
          id: String(payload.sub ?? ""),
          username: String(
            payload.username ??
              payload.sub ??
              "Operator"
          ),
          email: String(
            payload.email ?? ""
          ),
          role: (payload.role ?? "USER") as Role,
        });
      } else {
        setStoredToken(null);
        setToken(null);
        setUser(null);
      }
    }
  }, []);

  /**
   * Load the profile when a token is available.
   */
  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      try {
        if (token) {
          await fetchUserProfile();
        } else {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      cancelled = true;
    };
  }, [token, fetchUserProfile]);

  /**
   * Save the token after a successful login.
   * The login page must obtain this token from the backend first.
   */
  const login = useCallback(
    async (newToken: string): Promise<void> => {
      if (!newToken || !isTokenUsable(newToken)) {
        throw new Error(
          "The backend returned an invalid or expired access token."
        );
      }

      setStoredToken(newToken);
      setToken(newToken);
      setIsLoading(true);

      try {
        const profile = await apiGet<any>(
          "/auth/me",
          newToken
        );

        if (!profile || profile.id == null) {
          throw new Error(
            "Login succeeded, but the backend returned an invalid user profile."
          );
        }

        setUser({
          id: String(profile.id),
          username: String(profile.username ?? ""),
          email: String(profile.email ?? ""),
          role: (profile.role ?? "USER") as Role,
          isActive: profile.is_active ?? profile.isActive,
        });
      } catch (error) {
        setStoredToken(null);
        setToken(null);
        setUser(null);

        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Clear the local session.
   */
  const logout = useCallback((): void => {
    setStoredToken(null);
    setToken(null);
    setUser(null);
    setIsLoading(false);
  }, []);

  /**
   * Refresh the current user's profile.
   */
  const refreshUser = useCallback(async (): Promise<void> => {
    await fetchUserProfile();
  }, [fetchUserProfile]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: Boolean(token),
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
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
};
