import { ExecutionContext, BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrganizationGuard } from './organization.guard';
import { PrismaService } from '@repo/database';

describe('OrganizationGuard (Unit)', () => {
  let guard: OrganizationGuard;
  let mockPrisma: {
    organizationMembership: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      organizationMembership: {
        findUnique: jest.fn(),
      },
    };
    guard = new OrganizationGuard(mockPrisma as unknown as PrismaService);
  });

  const createMockContext = (
    headers: Record<string, string> = {},
    user: { id: string } | null = { id: 'user-1' },
  ): ExecutionContext => {
    const request = {
      headers,
      user,
      params: headers['x-organization-id'] ? { id: headers['x-organization-id'] } : {},
      activeOrganization: undefined,
      activeMembership: undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should return false if request.user is missing (unauthenticated)', async () => {
    const context = createMockContext({ 'x-organization-id': 'org-1' }, null);
    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should throw BadRequestException if x-organization-id header is missing', async () => {
    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(BadRequestException);
  });

  it('should throw ForbiddenException if user has missing membership in target organization', async () => {
    const context = createMockContext({ 'x-organization-id': 'org-unauthorized' });
    mockPrisma.organizationMembership.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user membership is suspended (isActive: false)', async () => {
    const context = createMockContext({ 'x-organization-id': 'org-1' });
    mockPrisma.organizationMembership.findUnique.mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      organizationId: 'org-1',
      isActive: false, // Suspended!
      organization: { id: 'org-1', isActive: true },
      role: { permissions: [] },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if organization itself is inactive', async () => {
    const context = createMockContext({ 'x-organization-id': 'org-1' });
    mockPrisma.organizationMembership.findUnique.mockResolvedValue({
      id: 'mem-1',
      userId: 'user-1',
      organizationId: 'org-1',
      isActive: true,
      organization: { id: 'org-1', isActive: false }, // Inactive org!
      role: { permissions: [] },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow access and populate activeOrganization and activeMembership on valid membership', async () => {
    const context = createMockContext({ 'x-organization-id': 'org-1' });
    const mockMembership = {
      id: 'mem-1',
      userId: 'user-1',
      organizationId: 'org-1',
      isActive: true,
      organization: { id: 'org-1', name: 'Acme Corp', isActive: true },
      role: { id: 'role-1', name: 'Owner', permissions: [] },
    };
    mockPrisma.organizationMembership.findUnique.mockResolvedValue(mockMembership);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);

    const req = context.switchToHttp().getRequest<{ activeOrganization: unknown; activeMembership: unknown }>();
    expect(req.activeOrganization).toEqual(mockMembership.organization);
    expect(req.activeMembership).toEqual(mockMembership);
  });
});
