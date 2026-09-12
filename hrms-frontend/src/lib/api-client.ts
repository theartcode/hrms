import { getAccessToken, setAccessToken } from "./token-store";
import { API_ENDPOINTS } from "@/constants/api-endpoints";

// Thrown instead of a plain Error so callers (React Query's retry/retryDelay
// in particular) can tell a 429 apart from a regular failure and back off
// using the server's own Retry-After hint instead of guessing.
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds: number | null = null
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";
const API_VERSION = "/api/v1";

/** For plain <img>/<a> URLs (no auth header, not a JSON apiFetch call) — e.g. the public logo proxy. */
export function apiAssetUrl(path: string): string {
  return `${API_BASE_URL}${API_VERSION}${path}`;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const token = getAccessToken();
  return fetch(`${API_BASE_URL}${API_VERSION}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = request(API_ENDPOINTS.AUTH.REFRESH, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          setAccessToken(null);
          return false;
        }
        const body = await res.json();
        setAccessToken(body.data.accessToken as string);
        return true;
      })
      .catch(() => {
        setAccessToken(null);
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const NO_RETRY_PATHS: string[] = [
  API_ENDPOINTS.AUTH.REFRESH,
  API_ENDPOINTS.AUTH.LOGIN,
];

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  allowRetry = true
): Promise<T> {
  const res = await request(path, init);

  if (res.status === 401 && allowRetry && !NO_RETRY_PATHS.includes(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, init, false);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body?.message ?? `API request failed: ${res.status} ${res.statusText}`;

    if (res.status === 429) {
      const retryAfterHeader = res.headers.get("Retry-After");
      const retryAfterSeconds = retryAfterHeader
        ? Number(retryAfterHeader)
        : null;
      throw new ApiError(
        message,
        429,
        Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null
      );
    }

    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

// XMLHttpRequest, not fetch — it's the only browser API that reports
// upload progress, which the file-upload UI needs for anything larger
// than a trivial image. Mirrors apiFetch's auth/401-retry contract.
export function apiUpload<T>(
  path: string,
  formData: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  function send(token: string | null): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE_URL}${API_VERSION}${path}`);
      xhr.withCredentials = true;
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 401) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            resolve(await send(getAccessToken()));
            return;
          }
        }
        let body: { message?: string } | null = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // non-JSON error body — fall through to the generic message below
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as T);
        } else {
          reject(new Error(body?.message ?? `Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed: network error"));
      xhr.send(formData);
    });
  }

  return send(getAccessToken());
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const res = await request(path);

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryRes = await request(path);
      if (!retryRes.ok) throw new Error(`Export failed: ${retryRes.status}`);
      return retryRes.blob();
    }
  }

  if (!res.ok) {
    throw new Error(`Export failed: ${res.status}`);
  }

  return res.blob();
}

export { refreshAccessToken };
