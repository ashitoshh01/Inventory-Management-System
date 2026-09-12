import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '@repo/database';

describe('AuditService (Unit)', () => {
  let auditService: AuditService;
  const mockPrisma = {
    auditEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    auditService = module.get<AuditService>(AuditService);
  });

  describe('sanitize()', () => {
    it('should redact sensitive keys: password, token, secret, cookie, authorization, database_url', () => {
      const input = {
        password: 'superSecretPassword',
        token: 'eyJhbGciOi...',
        secret: 'my-api-secret',
        cookie: 'sessionId=xyz',
        authorization: 'Bearer abc.def.ghi',
        database_url: 'postgresql://postgres:pwd@localhost:5432/db',
        safeField: 'visibleValue',
      };

      const result = auditService.sanitize(input);

      expect(result.password).toBe('[REDACTED]');
      expect(result.token).toBe('[REDACTED]');
      expect(result.secret).toBe('[REDACTED]');
      expect(result.cookie).toBe('[REDACTED]');
      expect(result.authorization).toBe('[REDACTED]');
      expect(result.database_url).toBe('[REDACTED]');
      expect(result.safeField).toBe('visibleValue');
    });

    it('should recursively redact sensitive fields in nested objects', () => {
      const input = {
        user: {
          id: 'user-1',
          credentials: {
            password: 'secretPassword',
            oldPassword: 'oldSecretPassword',
          },
          config: {
            webhookSecret: 'topSecret',
            database_url: 'postgres://...',
          },
          profile: {
            name: 'John Doe',
          },
        },
      };

      const result = auditService.sanitize(input);

      expect(result.user.id).toBe('user-1');
      expect(result.user.credentials.password).toBe('[REDACTED]');
      expect(result.user.credentials.oldPassword).toBe('[REDACTED]');
      expect(result.user.config.webhookSecret).toBe('[REDACTED]');
      expect(result.user.config.database_url).toBe('[REDACTED]');
      expect(result.user.profile.name).toBe('John Doe');
    });

    it('should redact sensitive keys inside arrays and array elements', () => {
      const input = {
        items: [
          { token: 'token-1', label: 'Primary' },
          { password: 'pwd', label: 'Secondary' },
        ],
        safeList: ['apple', 'banana'],
      };

      const result = auditService.sanitize(input);

      expect(result.items).toEqual([
        { token: '[REDACTED]', label: 'Primary' },
        { password: '[REDACTED]', label: 'Secondary' },
      ]);
      expect(result.safeList).toEqual(['apple', 'banana']);

      // Direct array sanitization
      const directArray = [
        { secret: 'sec-1', name: 'Item 1' },
        { database_url: 'postgres://...', name: 'Item 2' },
      ];
      expect(auditService.sanitize(directArray)).toEqual([
        { secret: '[REDACTED]', name: 'Item 1' },
        { database_url: '[REDACTED]', name: 'Item 2' },
      ]);
    });

    it('should handle non-object, null, and undefined values cleanly', () => {
      expect(auditService.sanitize(null)).toBeNull();
      expect(auditService.sanitize(undefined)).toBeUndefined();
      expect(auditService.sanitize('a string')).toBe('a string');
      expect(auditService.sanitize(12345)).toBe(12345);
    });
  });

  describe('logEvent()', () => {
    it('should log audit event with sanitized metadata', async () => {
      mockPrisma.auditEvent.create.mockResolvedValue({ id: 'audit-1' });

      await auditService.logEvent({
        organizationId: 'org-1',
        actorUserId: 'user-1',
        action: 'user.login',
        entityType: 'User',
        entityId: 'user-1',
        metadata: {
          password: 'plain-password',
          ip: '127.0.0.1',
        },
      });

      expect(mockPrisma.auditEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          actorUserId: 'user-1',
          action: 'user.login',
          entityType: 'User',
          entityId: 'user-1',
          metadata: {
            password: '[REDACTED]',
            ip: '127.0.0.1',
          },
        }),
      });
    });
  });
});
