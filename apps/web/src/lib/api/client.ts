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

const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
};

export const apiClient = async <T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> => {
  const url = `${getBaseUrl()}${endpoint}`;

  // Generate or propagate correlation id
  const requestId = crypto.randomUUID();

  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('x-request-id')) {
    headers.set('x-request-id', requestId);
  }

  if (typeof window !== 'undefined') {
    const orgId = localStorage.getItem('activeOrganizationId');
    if (orgId && !headers.has('x-organization-id')) {
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
