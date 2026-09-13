import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AuthRateLimitGuard, RateLimitOptions } from './auth-rate-limit.guard';

describe('AuthRateLimitGuard', () => {
  let guard: AuthRateLimitGuard;
  let reflector: Reflector;
  let configService: ConfigService;

  const mockResponse = () => {
    const headers: Record<string, unknown> = {};
    return {
      setHeader: jest.fn((k: string, v: unknown) => {
        headers[k] = v;
      }),
      headers,
    };
  };

  const createMockContext = (
    ip: string,
    forwardedFor?: string,
    options: RateLimitOptions = { limit: 3, windowSeconds: 2, keyPrefix: 'test' },
  ) => {
    const req = {
      socket: { remoteAddress: ip },
      headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
      route: { path: '/test' },
    };
    const res = mockResponse();

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(options);

    return { context, req, res };
  };

  beforeEach(() => {
    reflector = new Reflector();
    configService = new ConfigService();
    // Use an unroutable Redis port so it falls back to in-memory store in unit test
    jest.spyOn(configService, 'get').mockReturnValue('redis://localhost:99999');

    guard = new AuthRateLimitGuard(reflector, configService);
  });

  afterEach(() => {
    guard._resetMemoryStore();
  });

  it('1. Requests within limit are allowed and set rate limit headers', async () => {
    const { context, res } = createMockContext('10.0.0.1');

    // 1st request
    const allow1 = await guard.canActivate(context);
    expect(allow1).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 3);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 2);

    // 2nd request
    const allow2 = await guard.canActivate(context);
    expect(allow2).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);

    // 3rd request (at limit)
    const allow3 = await guard.canActivate(context);
    expect(allow3).toBe(true);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);
  });

  it('2. Request exceeding limit is blocked with 429 and Retry-After header', async () => {
    const { context, res } = createMockContext('10.0.0.2', undefined, {
      limit: 2,
      windowSeconds: 5,
      keyPrefix: 'test_block',
    });

    await guard.canActivate(context); // 1
    await guard.canActivate(context); // 2

    // 3rd request must throw 429
    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

    try {
      await guard.canActivate(context);
    } catch (err) {
      const httpErr = err as HttpException;
      expect(httpErr.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const response = httpErr.getResponse() as Record<string, unknown>;
      expect(response.error).toBe('TOO_MANY_REQUESTS');
    }

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
  });

  it('3. Forwarded IP header (proxy) is correctly extracted', async () => {
    const { context: ctxA } = createMockContext('127.0.0.1', '203.0.113.195, 10.0.0.1', {
      limit: 1,
      windowSeconds: 10,
      keyPrefix: 'proxy_test',
    });
    const { context: ctxB } = createMockContext('127.0.0.1', '198.51.100.1, 10.0.0.1', {
      limit: 1,
      windowSeconds: 10,
      keyPrefix: 'proxy_test',
    });

    // Client A uses their limit
    await guard.canActivate(ctxA);
    await expect(guard.canActivate(ctxA)).rejects.toThrow(HttpException);

    // Client B from different forwarded IP is NOT blocked by Client A
    const allowB = await guard.canActivate(ctxB);
    expect(allowB).toBe(true);
  });

  it('4. Rate limit resets after window expires', async () => {
    const { context } = createMockContext('10.0.0.3', undefined, {
      limit: 1,
      windowSeconds: 1,
      keyPrefix: 'expire_test',
    });

    await guard.canActivate(context);
    await expect(guard.canActivate(context)).rejects.toThrow(HttpException);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // After expiry, request is allowed again
    const allowAgain = await guard.canActivate(context);
    expect(allowAgain).toBe(true);
  });

  it('5. Allows access when no rate limit is configured on handler', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const { context } = createMockContext('10.0.0.4');

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
