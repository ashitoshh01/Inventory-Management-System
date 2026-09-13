import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from './client';

describe('API Client', () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    mockFetch.mockClear();
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://test-api/api/v1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('1. Successful API response - Should parse data and meta', async () => {
    const mockResponse = {
      data: { id: 1, name: 'Test Product' },
      meta: { requestId: 'req-123' },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const result = await apiClient<{ id: number; name: string }>('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      'http://test-api/api/v1/test',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );

    // Verify request ID was generated
    const callArgs = mockFetch.mock.calls[0];
    const headers = callArgs![1].headers as Headers;
    expect(headers.get('x-request-id')).toMatch(/^[a-zA-Z0-9_.-]{1,128}$/);

    expect(result).toEqual(mockResponse);
  });

  it('2. Backend error response - Should throw ApiError with correct fields', async () => {
    const errorResponse = {
      error: {
        code: 'TEST_ERROR',
        message: 'This is a test error',
        requestId: 'req-err-456',
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => errorResponse,
    });

    try {
      await apiClient('/test');
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const apiError = e as ApiError;
      expect(apiError.code).toBe('TEST_ERROR');
      expect(apiError.message).toBe('This is a test error');
      expect(apiError.requestId).toBe('req-err-456');
    }
  });

  it('3. Network failure - Should handle fetch rejection', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failed'));

    try {
      await apiClient('/test');
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const apiError = e as ApiError;
      expect(apiError.code).toBe('UNKNOWN_ERROR');
      expect(apiError.message).toBe(
        'An unknown error occurred while communicating with the server.',
      );
      expect(apiError.requestId).toBeTruthy();
    }
  });

  it('4. HTTP status preservation (Generic non-JSON error) - Should fallback gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    });

    try {
      await apiClient('/test');
      expect.fail('Should have thrown an error');
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      const apiError = e as ApiError;
      expect(apiError.code).toBe('UNKNOWN_ERROR');
      expect(apiError.requestId).toBeTruthy();
    }
  });

  it('5. requestId preservation - Should not overwrite provided requestId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: 'ok', meta: { requestId: 'custom-req' } }),
    });

    const customHeaders = new Headers();
    customHeaders.set('x-request-id', 'my-custom-id');

    await apiClient('/test', { headers: customHeaders });

    const callArgs = mockFetch.mock.calls[0];
    const headers = callArgs![1].headers as Headers;
    expect(headers.get('x-request-id')).toBe('my-custom-id');
  });

  it('6. Malformed/unexpected response handling - 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error('Should not be called');
      },
    });

    const result = await apiClient('/test');
    expect(result.data).toEqual({});
    expect(result.meta.requestId).toBeTruthy();
  });

  it('7. Automatic token refresh on 401 - Should refresh and retry successfully', async () => {
    // 1st call to /products returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 'UNAUTHORIZED', message: 'Token expired', requestId: '1' },
      }),
    });

    // 2nd call to /auth/refresh returns 200 OK
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { user: { id: 'u1' } } }),
    });

    // 3rd call retries /products and returns 200 OK
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'p1', name: 'Widget' }], meta: { requestId: '2' } }),
    });

    const result = await apiClient<{ id: string; name: string }[]>('/products');

    expect(result.data).toEqual([{ id: 'p1', name: 'Widget' }]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[0]![0]).toBe('http://test-api/api/v1/products');
    expect(mockFetch.mock.calls[1]![0]).toBe('http://test-api/api/v1/auth/refresh');
    expect(mockFetch.mock.calls[2]![0]).toBe('http://test-api/api/v1/products');
  });

  it('8. Failed refresh - Should not retry and throw error', async () => {
    // 1st call to /products returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 'UNAUTHORIZED', message: 'Token expired', requestId: '1' },
      }),
    });

    // 2nd call to /auth/refresh fails (401)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 'UNAUTHORIZED', message: 'Session expired', requestId: '2' },
      }),
    });

    await expect(apiClient('/products')).rejects.toThrow(ApiError);
    // Should have called /products and /auth/refresh, but NOT retried /products
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('9. Concurrent 401 requests - Deduplicates to a single /auth/refresh call', async () => {
    // Both endpoints return 401 initially
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 'UNAUTHORIZED', message: 'Token expired', requestId: '1' },
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 'UNAUTHORIZED', message: 'Token expired', requestId: '2' },
      }),
    });

    // Refresh succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { ok: true } }),
    });

    // Both retries succeed
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { item: 'A' }, meta: { requestId: '3' } }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { item: 'B' }, meta: { requestId: '4' } }),
    });

    const [resA, resB] = await Promise.all([apiClient('/endpointA'), apiClient('/endpointB')]);

    expect(resA.data).toEqual({ item: 'A' });
    expect(resB.data).toEqual({ item: 'B' });

    // Exactly 1 call to /auth/refresh was made
    const refreshCalls = mockFetch.mock.calls.filter((c) => c[0].includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('10. No infinite retry loop on persistent 401', async () => {
    // 1st call returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 'UNAUTHORIZED', message: 'Token expired', requestId: '1' },
      }),
    });

    // Refresh succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { ok: true } }),
    });

    // Retry STILL returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 'UNAUTHORIZED', message: 'Still unauthorized', requestId: '3' },
      }),
    });

    await expect(apiClient('/products')).rejects.toThrow(ApiError);

    // Total 3 calls: initial, refresh, single retry (no further calls)
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
