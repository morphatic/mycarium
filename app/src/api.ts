const BASE_URL = import.meta.env.VITE_API_URL as string | undefined;

const STORAGE_KEY = "mycarium-session";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getBaseUrl(): string {
  if (BASE_URL) return BASE_URL.replace(/\/$/, "");
  return window.location.origin;
}

function getToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token: string }).token;
  } catch {
    return null;
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${getBaseUrl()}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 204) return undefined as T;

  // Auto-logout on 401 (expired/invalid session) — but not for login/register
  if (res.status === 401 && !path.startsWith("/auth/")) {
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = "/";
    throw new ApiError(401, "Session expired");
  }

  const body = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  return body as T;
}
