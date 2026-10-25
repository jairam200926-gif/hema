/**
 * Minimal API client for VaultGuard frontend.
 * Uses the native fetch API (Axios is not a project dependency).
 * Base URL is read from VITE_API_BASE env var with a fallback for local dev.
 */

const DEFAULT_BASE_URL = "https://hema-msveqsht.onslate.in";

// Vite injects environment variables prefixed with VITE_ at build time.
export const API_BASE_URL: string =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) || DEFAULT_BASE_URL;

export function getStoredToken(): string | null {
  return localStorage.getItem("vaultguard_token") || localStorage.getItem("vg_token");
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem("vaultguard_token", token);
  } else {
    localStorage.removeItem("vaultguard_token");
    localStorage.removeItem("vg_token");
  }
}

/**
 * Helper to create a Bearer Authorization header.
 * The caller supplies the JWT token (e.g., from localStorage).
 */
export function authHeader(token?: string): HeadersInit {
  const activeToken = token || getStoredToken();
  return activeToken
    ? {
        Authorization: `Bearer ${activeToken}`,
      }
    : {};
}

/**
 * Formats API errors (including FastAPI/Pydantic validation details) into readable strings.
 */
export function formatErrorDetail(detail: any): string {
  if (!detail) return "";
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const rawMsg = item.msg || item.message || "";
          const cleanMsg = String(rawMsg).replace(/^Value error,\s*/i, "");
          const locParts = Array.isArray(item.loc)
            ? item.loc.filter((p: any) => p !== "body" && p !== "__root__")
            : [];
          const field = locParts.join(".");
          return field ? `${field}: ${cleanMsg}` : cleanMsg;
        }
        return String(item);
      })
      .filter(Boolean)
      .join("; ");
  }

  if (typeof detail === "object") {
    return detail.message || detail.msg || JSON.stringify(detail);
  }

  return String(detail);
}

/**
 * Generic request wrapper that returns the parsed JSON body.
 * Throws on non‑2xx responses with an error object containing `status` and the response payload.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  // Ensure the path starts with a slash when concatenated to the base URL.
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  const token = getStoredToken();
  const headers = {
    ...(token ? authHeader(token) : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    // The caller can override method, headers, body, etc.
    ...options,
    headers,
    // Ensure credentials are sent for cookies if needed.
    credentials: "include",
  });

  if (!response.ok) {
    // Try to parse JSON error body; fall back to plain text.
    let errorPayload: any;
    try {
      errorPayload = await response.json();
    } catch {
      errorPayload = { detail: await response.text() };
    }

    const formattedDetail = formatErrorDetail(errorPayload?.detail);
    const message = formattedDetail || errorPayload?.message || `Request failed with status ${response.status}`;

    const error = {
      status: response.status,
      ...errorPayload,
      detail: formattedDetail || message,
      message,
      rawDetail: errorPayload?.detail,
    };
    throw error;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  // Successful response – parse JSON.
  return (await response.json()) as T;
}

/**
 * Convenience helpers for common HTTP verbs.
 */
export const apiGet = <T>(path: string, token?: string): Promise<T> =>
  apiRequest<T>(path, {
    method: "GET",
    headers: token ? authHeader(token) : undefined,
  });

export const apiPost = <T>(
  path: string,
  body: any,
  token?: string
): Promise<T> =>
  apiRequest<T>(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? authHeader(token) : {}),
    },
    body: JSON.stringify(body),
  });

export const apiPut = <T>(
  path: string,
  body: any,
  token?: string
): Promise<T> =>
  apiRequest<T>(path, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? authHeader(token) : {}),
    },
    body: JSON.stringify(body),
  });

export const apiDelete = <T>(path: string, token?: string): Promise<T> =>
  apiRequest<T>(path, {
    method: "DELETE",
    headers: token ? authHeader(token) : undefined,
  });
