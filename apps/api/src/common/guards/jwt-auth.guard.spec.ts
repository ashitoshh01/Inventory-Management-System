import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '@repo/database';
import { ALLOW_PASSWORD_CHANGE_PENDING_KEY } from '../decorators/allow-password-change-pending.decorator';

describe('JwtAuthGuard (Unit)', () => {
  let guard: JwtAuthGuard;
  let mockJwtService: Partial<JwtService>;
  let mockPrisma: any;
  let mockReflector: Partial<Reflector>;

  beforeEach(() => {
    mockJwtService = {
      verifyAsync: jest.fn(),
    };

    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    mockReflector = {
      getAllAndOverride: jest.fn(),
    };

    guard = new JwtAuthGuard(
      mockJwtService as JwtService,
      mockPrisma as PrismaService,
      mockReflector as Reflector,
    );
  });

  const createMockContext = (cookies: Record<string, string> = {}): ExecutionContext => {
    const request = {
      cookies,
      user: null as any,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('throws UnauthorizedException when accessToken cookie is missing', async () => {
    const context = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('allows access when user is active and mustChangePassword is false', async () => {
    const context = createMockContext({ accessToken: 'valid-token' });

    (mockJwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-1' });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      isActive: true,
      isPlatformAdmin: false,
      mustChangePassword: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(context.switchToHttp().getRequest().user).toBeDefined();
  });

  it('blocks access with ForbiddenException when mustChangePassword is true and route does NOT allow pending', async () => {
    const context = createMockContext({ accessToken: 'valid-token' });

    (mockJwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-temp' });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-temp',
      email: 'temp@example.com',
      isActive: true,
      isPlatformAdmin: false,
      mustChangePassword: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(false);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
      ALLOW_PASSWORD_CHANGE_PENDING_KEY,
      expect.any(Array),
    );
  });

  it('allows access when mustChangePassword is true AND route has AllowPasswordChangePending', async () => {
    const context = createMockContext({ accessToken: 'valid-token' });

    (mockJwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-temp' });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-temp',
      email: 'temp@example.com',
      isActive: true,
      isPlatformAdmin: false,
      mustChangePassword: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (mockReflector.getAllAndOverride as jest.Mock).mockReturnValue(true);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
