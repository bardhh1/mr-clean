const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)
  ?.trim()
  .replace(/\/+$/, "");

export const hasApiConfig = Boolean(configuredBaseUrl);

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown>;
  retryAuth?: boolean;
};

type ApiErrorPayload = {
  message?: string | string[];
  requestId?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let refreshRequest: Promise<boolean> | null = null;

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  if (!configuredBaseUrl) {
    throw new Error("API-ja e Mr. Clean nuk është konfiguruar.");
  }

  const response = await performRequest(path, options);
  const shouldRefresh = response.status === 401
    && options.retryAuth !== false
    && path.startsWith("/admin/")
    && !path.startsWith("/admin/auth/");

  if (shouldRefresh && await refreshSession()) {
    return apiRequest<T>(path, { ...options, retryAuth: false });
  }

  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function invalidateAdminSessionRefresh(): void {
  refreshRequest = null;
}

async function performRequest(path: string, options: ApiRequestOptions): Promise<Response> {
  const { body: requestedBody, retryAuth, ...requestOptions } = options;
  void retryAuth;
  const headers = new Headers(requestOptions.headers);
  headers.set("accept", "application/json");
  headers.set("x-mr-clean-client", "mr-clean-web-v1");

  let body = requestedBody;
  if (body && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("content-type", "application/json");
    body = JSON.stringify(body);
  }

  return fetch(`${configuredBaseUrl}${path}`, {
    ...requestOptions,
    body: body as BodyInit | undefined,
    credentials: "include",
    headers
  });
}

async function refreshSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = performRequest("/admin/auth/refresh", {
      method: "POST",
      retryAuth: false
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshRequest = null;
      });
  }
  return refreshRequest;
}

async function responseError(response: Response): Promise<ApiError> {
  const payload = await response.json().catch(() => null) as ApiErrorPayload | null;
  const message = Array.isArray(payload?.message)
    ? payload.message.join(" ")
    : payload?.message || `Kërkesa dështoi (${response.status}).`;
  return new ApiError(message, response.status, payload?.requestId);
}
