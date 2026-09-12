import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

describe('PermissionsGuard (Unit)', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const createMockContext = (
    activeMembership: unknown,
    routePermissions: string[] | null = null,
  ): ExecutionContext => {
    const request = {
      activeMembership,
    };

    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation(((key: string) => {
      if (key === PERMISSIONS_KEY) return routePermissions;
      return null;
    }) as unknown as typeof reflector.getAllAndOverride);

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('should allow access if no permissions are required on route', () => {
    const context = createMockContext(null, null);
    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if activeMembership is missing (wrong or missing org context)', () => {
    const context = createMockContext(null, ['organization.read']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user lacks the required permission', () => {
    const membership = {
      organizationId: 'org-1',
      role: {
        id: 'role-member',
        name: 'Member',
        permissions: [{ permission: { action: 'organization.read' } }],
      },
    };

    const context = createMockContext(membership, ['organization.manage']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow access if user has all required permissions for active organization', () => {
    const membership = {
      organizationId: 'org-1',
      role: {
        id: 'role-admin',
        name: 'Admin',
        permissions: [
          { permission: { action: 'organization.read' } },
          { permission: { action: 'organization.manage' } },
        ],
      },
    };

    const context = createMockContext(membership, ['organization.read', 'organization.manage']);
    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should deny if membership belongs to wrong organization context or lacks role permissions structure', () => {
    const brokenMembership = {
      organizationId: 'org-wrong',
      role: null,
    };

    const context = createMockContext(brokenMembership, ['organization.read']);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
