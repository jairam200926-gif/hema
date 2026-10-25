const DEFAULT_BASE_URL = "https://backend-seven-brown-67.vercel.app";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE || DEFAULT_BASE_URL
).replace(/\/+$/, "");

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Avoid adding /api twice if the caller already includes it.
  const apiPath = normalizedPath.startsWith("/api/")
    ? normalizedPath
    : `/api${normalizedPath}`;

  const url = `${API_BASE_URL}${apiPath}`;
  const token = getStoredToken();

  const headers = new Headers(options.headers);

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
      `Cannot reach the backend at ${API_BASE_URL}. Check the backend deployment and CORS configuration.`
    );
  }

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
