
/**
 * VaultGuard API Client
 * Frontend: React + Vite
 * Backend: FastAPI
 */

const DEFAULT_BASE_URL = "https://backend-seven-brown-67.vercel.app";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE || DEFAULT_BASE_URL
).replace(/\/+$/, "");

/**
 * Retrieve the saved authentication token.
 */
export function getStoredToken(): string | null {
  return (
    localStorage.getItem("vaultguard_token") ||
    localStorage.getItem("vg_token")
  );
}

/**
 * Store or remove the authentication token.
 */
export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem("vaultguard_token", token);
    localStorage.setItem("vg_token", token);
  } else {
    localStorage.removeItem("vaultguard_token");
    localStorage.removeItem("vg_token");
  }
}

/**
 * Build the Authorization header.
 */
export function authHeader(token?: string): HeadersInit {
  const activeToken = token || getStoredToken();

  return activeToken
    ? { Authorization: `Bearer ${activeToken}` }
    : {};
}

/**
 * Convert FastAPI/Pydantic error details into readable text.
 */
export function formatErrorDetail(detail: any): string {
  if (!detail) return "";

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item: any) => {
        if (typeof item === "string") return item;

        if (item && typeof item === "object") {
          const message = String(item.msg || item.message || "");
          const cleanMessage = message.replace(/^Value error,\s*/i, "");

          const location = Array.isArray(item.loc)
            ? item.loc
                .filter(
                  (part: unknown) =>
                    part !== "body" && part !== "__root__"
                )
                .join(".")
            : "";

          return location
            ? `${location}: ${cleanMessage}`
            : cleanMessage;
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
 * Construct the correct backend endpoint.
 *
 * Examples:
 * /auth/register -> /api/auth/register
 * /api/auth/me   -> /api/auth/me
 */
function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const apiPath =
    normalizedPath === "/api" ||
    normalizedPath.startsWith("/api/")
      ? normalizedPath
      : `/api${normalizedPath}`;

  return `${API_BASE_URL}${apiPath}`;
}

/**
 * Generic API request wrapper.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = buildApiUrl(path);
  const headers = new Headers(options.headers);
  const token = getStoredToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error(
      `Unable to connect to the backend at ${API_BASE_URL}. ` +
        "Check backend deployment, network access, and CORS configuration."
    );
  }

  // Read the response body only once.
  const responseText = await response.text();

  let payload: any = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { detail: responseText };
    }
  }

  if (!response.ok) {
    const detail = formatErrorDetail(payload?.detail);

    const message =
      detail ||
      payload?.message ||
      `Request failed with status ${response.status}`;

    throw Object.assign(new Error(message), {
      status: response.status,
      detail: message,
      rawDetail: payload?.detail,
    });
  }

  if (response.status === 204 || !responseText) {
    return null as T;
  }

  return payload as T;
}

/**
 * GET request.
 */
export function apiGet<T>(
  path: string,
  token?: string
): Promise<T> {
  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return apiRequest<T>(path, {
    method: "GET",
    headers,
  });
}

/**
 * POST request.
 */
export function apiPost<T = any>(
  path: string,
  body: unknown,
  token?: string
): Promise<T> {
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return apiRequest<T>(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * PUT request.
 */
export function apiPut<T = any>(
  path: string,
  body: unknown,
  token?: string
): Promise<T> {
  const headers = new Headers({
    "Content-Type": "application/json",
  });

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return apiRequest<T>(path, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * DELETE request.
 */
export function apiDelete<T = any>(
  path: string,
  token?: string
): Promise<T> {
  const headers = new Headers();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return apiRequest<T>(path, {
    method: "DELETE",
    headers,
  });
}
