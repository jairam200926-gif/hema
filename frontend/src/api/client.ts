/**
 * VaultGuard API Client
 * Frontend: React + Vite
 * Backend: FastAPI
 */

const DEFAULT_BASE_URL = "https://backend-seven-brown-67.vercel.app";
const configuredBaseUrl = import.meta.env.VITE_API_BASE as string | undefined;

export const API_BASE_URL = (
  configuredBaseUrl?.trim() || DEFAULT_BASE_URL
).replace(/\/+$/, "");

export function getStoredToken(): string | null {
  return (
    localStorage.getItem("vaultguard_token") ||
    localStorage.getItem("vg_token")
  );
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem("vaultguard_token", token);
    localStorage.setItem("vg_token", token);
  } else {
    localStorage.removeItem("vaultguard_token");
    localStorage.removeItem("vg_token");
  }
}

export function authHeader(token?: string): HeadersInit {
  const activeToken = token || getStoredToken();
  return activeToken ? { Authorization: `Bearer ${activeToken}` } : {};
}

export function formatErrorDetail(detail: any): string {
  if (!detail) return "";
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((item: any) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const message = String(item.msg || item.message || "");
          const cleanMessage = message.replace(/^Value error,\s*/i, "");
          const location = Array.isArray(item.loc)
            ? item.loc
                .filter((part: unknown) => part !== "body" && part !== "__root__")
                .join(".")
            : "";
          return location ? `${location}: ${cleanMessage}` : cleanMessage;
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
 * /auth/register -> /api/auth/register
 * /api/auth/me   -> /api/auth/me
 */
function buildApiUrl(path: string): string {
  // Keep absolute URLs untouched if a caller deliberately supplies one.
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const apiPath =
    normalizedPath === "/api" || normalizedPath.startsWith("/api/")
      ? normalizedPath
      : `/api${normalizedPath}`;

  return `${API_BASE_URL}${apiPath}`;
}

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
