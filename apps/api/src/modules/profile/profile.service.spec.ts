import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { PrismaService } from '@repo/database';
import { AuditService } from '../audit/audit.service';

describe('ProfileService (Unit)', () => {
  let service: ProfileService;
  let mockPrisma: any;
  let mockAudit: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    mockAudit = {
      logEvent: jest.fn().mockResolvedValue({}),
    };

    service = new ProfileService(
      mockPrisma as unknown as PrismaService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('getProfile', () => {
    it('returns user profile and active memberships', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'user@example.com',
        isActive: true,
        isPlatformAdmin: false,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberships: [
          {
            id: 'm1',
            userId: 'u1',
            organizationId: 'org1',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            role: { id: 'r1', name: 'Owner', description: 'Owner role' },
            organization: {
              id: 'org1',
              name: 'Acme',
              slug: 'acme',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      });

      const profile = await service.getProfile('u1');
      expect(profile.user.id).toBe('u1');
      expect(profile.user.email).toBe('user@example.com');
      expect(profile.memberships).toHaveLength(1);
      expect(profile.activeOrganization?.name).toBe('Acme');
    });

    it('throws NotFoundException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates email and logs audit event', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'u1',
          email: 'old@example.com',
        })
        .mockResolvedValueOnce(null); // uniqueness check: not taken

      mockPrisma.user.update.mockResolvedValue({
        id: 'u1',
        email: 'new@example.com',
        isActive: true,
        isPlatformAdmin: false,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.updateProfile('u1', { email: 'new@example.com' });
      expect(result.email).toBe('new@example.com');
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.profile_updated',
          actorUserId: 'u1',
          metadata: {
            previousEmail: 'old@example.com',
            newEmail: 'new@example.com',
          },
        }),
      );
    });

    it('throws ConflictException if email is already taken by another user', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'u1',
          email: 'current@example.com',
        })
        .mockResolvedValueOnce({
          id: 'u2',
          email: 'taken@example.com',
        });

      await expect(
        service.updateProfile('u1', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
