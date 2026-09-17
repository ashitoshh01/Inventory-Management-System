export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId: string;
}

export class ApiError extends Error {
  public code: string;
  public requestId: string;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.code = payload.code;
    this.requestId = payload.requestId;
  }
}

export interface ApiResponse<T> {
  data: T;
  meta: {
    requestId: string;
    page?: number;
    pageSize?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
  };
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

export interface ApiClientOptions extends RequestInit {
  _isRetry?: boolean;
}

export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
};

// Global in-flight refresh promise to deduplicate concurrent refresh calls
let refreshPromise: Promise<boolean> | null = null;

export const executeRefresh = async (): Promise<boolean> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const url = `${getBaseUrl()}/auth/refresh`;
      const requestId = crypto.randomUUID();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
        },
        credentials: 'include',
      });

      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// Reset refresh state (for testing)
export const _resetRefreshState = () => {
  refreshPromise = null;
};

export const apiClient = async <T>(
  endpoint: string,
  options?: ApiClientOptions,
): Promise<ApiResponse<T>> => {
  const url = `${getBaseUrl()}${endpoint}`;

  // Generate or propagate correlation id
  const requestId = crypto.randomUUID();

  const headers = new Headers(options?.headers);
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  if (!headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('x-request-id')) {
    headers.set('x-request-id', requestId);
  }

  if (typeof window !== 'undefined') {
    const isAdminEndpoint = endpoint.startsWith('/admin');
    const orgId = localStorage.getItem('activeOrganizationId');
    if (orgId && !headers.has('x-organization-id') && !isAdminEndpoint) {
      headers.set('x-organization-id', orgId);
    }
  }

  // Allow credentials for auth cookies
  const credentials = options?.credentials || 'include';

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers, credentials });
  } catch {
    throw new ApiError({
      code: 'UNKNOWN_ERROR',
      message: 'An unknown error occurred while communicating with the server.',
      requestId,
    });
  }

  // Handle 401 Unauthorized for token refresh
  const isAuthEndpoint =
    endpoint.startsWith('/auth/login') ||
    endpoint.startsWith('/auth/refresh');

  if (response.status === 401 && !options?._isRetry && !isAuthEndpoint) {
    const refreshSuccess = await executeRefresh();

    if (refreshSuccess) {
      // Retry original request once with _isRetry = true to prevent loops
      return apiClient<T>(endpoint, {
        ...options,
        _isRetry: true,
      });
    } else {
      // Refresh failed: clear client state and redirect to login if in browser
      if (typeof window !== 'undefined') {
        localStorage.removeItem('activeOrganizationId');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
  }

  if (!response.ok) {
    try {
      const errorData = (await response.json()) as ApiErrorResponse;
      if (errorData.error) {
        throw new ApiError(errorData.error);
      }
    } catch (e: unknown) {
      if (e instanceof ApiError) throw e;
      throw new ApiError({
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred while communicating with the server.',
        requestId,
      });
    }
    throw new ApiError({
      code: 'HTTP_ERROR',
      message: `HTTP error ${response.status}`,
      requestId,
    });
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return { data: {} as T, meta: { requestId } };
  }

  const data = (await response.json()) as ApiResponse<T>;
  return data;
};
