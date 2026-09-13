import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, Prisma } from '@repo/database';
import type {
  NotificationDto,
  NotificationsListResponseDto,
  UnreadCountDto,
} from '@repo/types';
import { QueryNotificationsDto } from './dto/notifications-query.dto';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves paginated notifications for the authenticated user and organization.
   * Includes both user-specific notifications and org-wide broadcast notifications.
   */
  async getNotifications(
    organizationId: string,
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<NotificationsListResponseDto> {
    const where: Prisma.NotificationWhereInput = {
      organizationId,
      OR: [{ userId: null }, { userId }],
      ...(query.unreadOnly ? { isRead: false } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const skip = query.getSkip();
    const take = query.getTake();

    const [total, unreadCount, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: {
          organizationId,
          OR: [{ userId: null }, { userId }],
          isRead: false,
        },
      }),
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const mappedItems: NotificationDto[] = items.map((n) => ({
      id: n.id,
      organizationId: n.organizationId,
      userId: n.userId,
      type: n.type,
      title: n.title,
      message: n.message,
      metadata: n.metadata as Record<string, unknown> | null,
      isRead: n.isRead,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    }));

    const limit = query.getTake();
    return {
      items: mappedItems,
      total,
      unreadCount,
      page: query.page ?? 1,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Returns current unread notifications count for the authenticated user/org.
   */
  async getUnreadCount(organizationId: string, userId: string): Promise<UnreadCountDto> {
    const count = await this.prisma.notification.count({
      where: {
        organizationId,
        OR: [{ userId: null }, { userId }],
        isRead: false,
      },
    });

    return { unreadCount: count };
  }

  /**
   * Marks a specific notification as read.
   * Enforces tenant isolation and recipient ownership.
   */
  async markAsRead(
    organizationId: string,
    userId: string,
    notificationId: string,
  ): Promise<NotificationDto> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        organizationId,
        OR: [{ userId: null }, { userId }],
      },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    if (notification.isRead) {
      return {
        id: notification.id,
        organizationId: notification.organizationId,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata as Record<string, unknown> | null,
        isRead: notification.isRead,
        readAt: notification.readAt ? notification.readAt.toISOString() : null,
        createdAt: notification.createdAt.toISOString(),
        updatedAt: notification.updatedAt.toISOString(),
      };
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      id: updated.id,
      organizationId: updated.organizationId,
      userId: updated.userId,
      type: updated.type,
      title: updated.title,
      message: updated.message,
      metadata: updated.metadata as Record<string, unknown> | null,
      isRead: updated.isRead,
      readAt: updated.readAt ? updated.readAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Marks all unread notifications as read for the user/organization.
   */
  async markAllAsRead(organizationId: string, userId: string): Promise<{ markedCount: number }> {
    const res = await this.prisma.notification.updateMany({
      where: {
        organizationId,
        OR: [{ userId: null }, { userId }],
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { markedCount: res.count };
  }
}
