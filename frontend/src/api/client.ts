const DEFAULT_BASE_URL = "https://backend-seven-brown-67.vercel.app/";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE || DEFAULT_BASE_URL
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
  } else {
    localStorage.removeItem("vaultguard_token");
    localStorage.removeItem("vg_token");
  }
}

export function authHeader(token?: string): HeadersInit {
  const activeToken = token || getStoredToken();

  return activeToken
    ? { Authorization: `Bearer ${activeToken}` }
    : {};
}

export function formatErrorDetail(detail: any): string {
  if (!detail) return "";

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;

        if (item && typeof item === "object") {
          const message = String(item.msg || item.message || "");
          const cleanMessage = message.replace(
            /^Value error,\s*/i,
            ""
          );

          const location = Array.isArray(item.loc)
            ? item.loc.filter(
                (part: any) =>
                  part !== "body" && part !== "__root__"
              )
            : [];

          return location.length
            ? `${location.join(".")}: ${cleanMessage}`
            : cleanMessage;
        }

        return String(item);
      })
      .filter(Boolean)
      .join("; ");
  }

  if (typeof detail === "object") {
    return (
      detail.message ||
      detail.msg ||
      JSON.stringify(detail)
    );
  }

  return String(detail);
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  const url = `${API_BASE_URL}${normalizedPath}`;

  const headers = new Headers(options.headers);

  const token = getStoredToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    // Read the response body exactly once.
    const responseText = await response.text();

    let responseData: any = null;

    if (responseText.trim()) {
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }
    }

    if (!response.ok) {
      const detail =
        typeof responseData === "object" && responseData !== null
          ? responseData.detail
          : responseData;

      const message =
        formatErrorDetail(detail) ||
        (typeof responseData === "object" && responseData !== null
          ? responseData.message
          : "") ||
        `Request failed with status ${response.status}`;

      throw new Error(
        `${message} (HTTP ${response.status})`
      );
    }

    // Successful response with no content.
    if (response.status === 204 || !responseText.trim()) {
      return null as T;
    }

    // Successful response should normally contain JSON.
    if (typeof responseData === "string") {
      throw new Error(
        "The server returned a non-JSON response. Check the API URL and backend configuration."
      );
    }

    return responseData as T;
  } catch (error: unknown) {
    if (error instanceof Error) {
      // Preserve server errors instead of reporting every error as a network issue.
      if (
        error.message.includes("(HTTP ") ||
        error.message.includes("non-JSON response")
      ) {
        throw error;
      }

      console.error("VaultGuard API request failed:", {
        url,
        error: error.message,
      });

      throw new Error(
        `Unable to connect to the API at ${API_BASE_URL}. ` +
          `Check that the backend is running, the API URL is correct, ` +
          `and CORS allows your frontend domain. Details: ${error.message}`
      );
    }

    throw new Error("An unexpected API error occurred.");
  }
}

export const apiGet = <T>(
  path: string,
  token?: string
): Promise<T> =>
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

export const apiDelete = <T>(
  path: string,
  token?: string
): Promise<T> =>
  apiRequest<T>(path, {
    method: "DELETE",
    headers: token ? authHeader(token) : undefined,
  });
