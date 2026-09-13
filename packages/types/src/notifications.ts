export type NotificationType =
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'EXPORT_READY'
  | 'EXPORT_FAILED'
  | 'IMPORT_COMPLETED'
  | 'IMPORT_FAILED'
  | 'SYSTEM';

export interface NotificationDto {
  id: string;
  organizationId: string;
  userId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationQueryParams {
  unreadOnly?: boolean | string;
  type?: NotificationType;
  page?: number | string;
  limit?: number | string;
}

export interface NotificationsListResponseDto {
  items: NotificationDto[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UnreadCountDto {
  unreadCount: number;
}
