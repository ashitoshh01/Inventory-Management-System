import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Organization } from '@repo/database';
import { DashboardService } from './dashboard.service';
import { IsOptional, IsString, IsUUID } from 'class-validator';

class DashboardQueryDto {
  @IsOptional()
  @IsUUID('4')
  warehouseId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermissions('stock.read')
  async getStats(
    @CurrentOrganization() org: Organization,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getStats(org.id, query);
  }

  @Get('inventory-by-category')
  @RequirePermissions('stock.read')
  async getInventoryByCategory(
    @CurrentOrganization() org: Organization,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getInventoryByCategory(org.id, query);
  }

  @Get('stock-status')
  @RequirePermissions('stock.read')
  async getStockStatus(
    @CurrentOrganization() org: Organization,
    @Query() query: DashboardQueryDto,
  ) {
    return this.dashboardService.getStockStatus(org.id, query);
  }

  @Get('recent-activities')
  @RequirePermissions('stock.read')
  async getRecentActivities(
    @CurrentOrganization() org: Organization,
  ) {
    return this.dashboardService.getRecentActivities(org.id);
  }
}
