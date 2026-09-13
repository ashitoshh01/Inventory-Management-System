import { Controller, Get, Patch, Post, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Organization, User } from '@repo/database';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/notifications-query.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequirePermissions('notification.read')
  async getNotifications(
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.getNotifications(org.id, user.id, query);
  }

  @Get('unread-count')
  @RequirePermissions('notification.read')
  async getUnreadCount(
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
  ) {
    return this.notificationsService.getUnreadCount(org.id, user.id);
  }

  @Patch(':id/read')
  @RequirePermissions('notification.manage')
  async markAsRead(
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markAsRead(org.id, user.id, id);
  }

  @Post('read-all')
  @RequirePermissions('notification.manage')
  async markAllAsRead(
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
  ) {
    return this.notificationsService.markAllAsRead(org.id, user.id);
  }
}
