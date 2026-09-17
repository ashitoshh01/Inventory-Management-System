import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

describe('PlatformAdminGuard (Unit)', () => {
  let guard: PlatformAdminGuard;

  beforeEach(() => {
    guard = new PlatformAdminGuard();
  });

  const createMockContext = (user: unknown): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('should allow access when user is a platform admin', () => {
    const context = createMockContext({
      id: 'admin-1',
      email: 'admin@stockministry.com',
      isPlatformAdmin: true,
      isActive: true,
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user is NOT a platform admin', () => {
    const context = createMockContext({
      id: 'user-1',
      email: 'user@tenant.com',
      isPlatformAdmin: false,
      isActive: true,
    });
    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Platform administrator access required'),
    );
  });

  it('should throw ForbiddenException when isPlatformAdmin is undefined/missing', () => {
    const context = createMockContext({
      id: 'owner-1',
      email: 'owner@tenant.com',
      isActive: true,
    });
    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Platform administrator access required'),
    );
  });

  it('should throw ForbiddenException when user is not present on request (unauthenticated)', () => {
    const context = createMockContext(null);
    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Authentication required'),
    );
  });
});
