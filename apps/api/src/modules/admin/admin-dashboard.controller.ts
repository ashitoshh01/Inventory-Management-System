import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  @Get()
  async getDashboardStats() {
    return this.dashboardService.getStats();
  }

  @Get('activity')
  async getRecentActivity(@Query('limit') limit?: number) {
    const take = limit ? Number(limit) : 20;
    return this.dashboardService.getRecentActivity(take);
  }
}
