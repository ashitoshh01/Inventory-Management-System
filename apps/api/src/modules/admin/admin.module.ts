import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { HealthModule } from '../health/health.module';

import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';

import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';

import { AdminOrganizationsService } from './admin-organizations.service';
import { AdminOrganizationsController } from './admin-organizations.controller';

import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';

import { AdminRolesController } from './admin-roles.controller';

import { AdminAuditService } from './admin-audit.service';
import { AdminAuditController } from './admin-audit.controller';

import { AdminAccountRequestsService } from './admin-account-requests.service';
import { AdminAccountRequestsController } from './admin-account-requests.controller';

import { AdminInventoryController } from './admin-inventory.controller';

import { AdminSystemController } from './admin-system.controller';

@Module({
  imports: [AuditModule, HealthModule],
  controllers: [
    AdminDashboardController,
    AdminOrganizationsController,
    AdminUsersController,
    AdminRolesController,
    AdminAuditController,
    AdminAccountRequestsController,
    AdminInventoryController,
    AdminSystemController,
  ],
  providers: [
    PlatformAdminGuard,
    AdminDashboardService,
    AdminOrganizationsService,
    AdminUsersService,
    AdminAuditService,
    AdminAccountRequestsService,
  ],
  exports: [PlatformAdminGuard],
})
export class AdminModule {}
