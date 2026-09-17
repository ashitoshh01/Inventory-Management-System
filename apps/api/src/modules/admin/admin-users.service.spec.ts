import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '@repo/database';
import { AuditService } from '../audit/audit.service';

describe('AdminUsersService (Unit)', () => {
  let service: AdminUsersService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      organizationMembership: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(mockPrisma)),
    };

    mockAudit = {
      logEvent: jest.fn().mockResolvedValue({}),
    };

    service = new AdminUsersService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('should throw ConflictException if user email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-id',
        email: 'user@example.com',
      });

      await expect(
        service.create(
          { email: 'user@example.com', password: 'password123' },
          'admin-id',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user, hash password and log audit event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: 'new@example.com',
        isActive: true,
        isPlatformAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(
        { email: 'new@example.com', password: 'securePassword123' },
        'admin-id',
      );

      expect(result.id).toBe('new-user-id');
      expect(result.email).toBe('new@example.com');
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.create',
          actorUserId: 'admin-id',
          entityId: 'new-user-id',
        }),
      );
    });
  });

  describe('update', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { isActive: false }, 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user status and log audit event', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        isActive: true,
      });

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        isActive: false,
        isPlatformAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = await service.update('user-1', { isActive: false }, 'admin-id');
      expect(updated.isActive).toBe(false);
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.update',
          actorUserId: 'admin-id',
          entityId: 'user-1',
        }),
      );
    });
  });

  describe('addMembership', () => {
    it('should throw ConflictException if user is already a member', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' });
      mockPrisma.organization.findUnique.mockResolvedValue({ id: 'org1' });
      mockPrisma.role.findUnique.mockResolvedValue({ id: 'role1' });
      mockPrisma.organizationMembership.findUnique.mockResolvedValue({ id: 'm1' });

      await expect(
        service.addMembership(
          'u1',
          { organizationId: 'org1', roleId: 'role1' },
          'admin-id',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
