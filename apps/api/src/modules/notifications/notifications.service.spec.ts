import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/notifications-query.dto';
import { PrismaService } from '@repo/database';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  const mockOrgId = 'org-123';
  const mockUserId = 'user-123';
  const mockNotification = {
    id: 'notif-1',
    organizationId: mockOrgId,
    userId: mockUserId,
    type: 'LOW_STOCK',
    title: 'Low Stock Alert',
    message: 'Product SKU-1 is running low (5 remaining)',
    metadata: { productId: 'prod-1', warehouseId: 'wh-1', quantity: 5 },
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-09-14T00:00:00.000Z'),
    updatedAt: new Date('2026-09-14T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('getNotifications', () => {
    it('should return paginated notifications and metadata with default parameters', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification]);
      prisma.notification.count.mockResolvedValue(1);

      const queryDto = plainToInstance(QueryNotificationsDto, {});
      const result = await service.getNotifications(mockOrgId, mockUserId, queryDto);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: mockOrgId,
            OR: [{ userId: null }, { userId: mockUserId }],
          },
          take: 20,
          skip: 0,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.id).toEqual('notif-1');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should apply unreadOnly and type filters correctly', async () => {
      prisma.notification.findMany.mockResolvedValue([mockNotification]);
      prisma.notification.count.mockResolvedValue(1);

      const queryDto = plainToInstance(QueryNotificationsDto, {
        unreadOnly: true,
        type: 'LOW_STOCK' as any,
        page: 2,
        limit: 10,
      });

      await service.getNotifications(mockOrgId, mockUserId, queryDto);

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: mockOrgId,
            OR: [{ userId: null }, { userId: mockUserId }],
            isRead: false,
            type: 'LOW_STOCK',
          },
          take: 10,
          skip: 10,
        }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return the unread count for the organization and user', async () => {
      prisma.notification.count.mockResolvedValue(3);

      const result = await service.getUnreadCount(mockOrgId, mockUserId);

      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrgId,
          OR: [{ userId: null }, { userId: mockUserId }],
          isRead: false,
        },
      });
      expect(result).toEqual({ unreadCount: 3 });
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read and return updated entity', async () => {
      prisma.notification.findFirst.mockResolvedValue(mockNotification);
      prisma.notification.update.mockResolvedValue({
        ...mockNotification,
        isRead: true,
        readAt: new Date('2026-09-14T01:00:00.000Z'),
      });

      const result = await service.markAsRead(mockOrgId, mockUserId, 'notif-1');

      expect(prisma.notification.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'notif-1',
          organizationId: mockOrgId,
          OR: [{ userId: null }, { userId: mockUserId }],
        },
      });
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
        }),
      });
      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException if notification does not exist or belongs to another org (IDOR protection)', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead(mockOrgId, mockUserId, 'notif-999')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read and return the updated count', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead(mockOrgId, mockUserId);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: mockOrgId,
          OR: [{ userId: null }, { userId: mockUserId }],
          isRead: false,
        },
        data: expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
        }),
      });
      expect(result).toEqual({ markedCount: 5 });
    });
  });
});
