import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Organization } from '@repo/database';
import { ReportsService } from './reports.service';
import { QueryReportDto, ExportReportDto } from './dto/reports-query.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('stock-movement')
  @RequirePermissions('stock.read')
  async getStockMovementReport(
    @CurrentOrganization() org: Organization,
    @Query() query: QueryReportDto,
  ) {
    return this.reportsService.getStockMovementReport(org.id, query);
  }

  @Get('inventory-valuation')
  @RequirePermissions('stock.read')
  async getInventoryValuationReport(
    @CurrentOrganization() org: Organization,
    @Query() query: QueryReportDto,
  ) {
    return this.reportsService.getInventoryValuationReport(org.id, query);
  }

  @Get('reconciliation')
  @RequirePermissions('stock.read')
  async getReconciliationReport(
    @CurrentOrganization() org: Organization,
    @Query() query: QueryReportDto,
  ) {
    return this.reportsService.getReconciliationReport(org.id, query);
  }

  @Get('procurement')
  @RequirePermissions('purchase-order.read')
  async getProcurementReport(
    @CurrentOrganization() org: Organization,
    @Query() query: QueryReportDto,
  ) {
    return this.reportsService.getProcurementReport(org.id, query);
  }

  @Get('sales')
  @RequirePermissions('sales-order.read')
  async getSalesReport(@CurrentOrganization() org: Organization, @Query() query: QueryReportDto) {
    return this.reportsService.getSalesReport(org.id, query);
  }

  @Get('export')
  @RequirePermissions('stock.read')
  async exportReport(
    @CurrentOrganization() org: Organization,
    @Query() query: ExportReportDto,
    @Res() res: Response,
  ) {
    return this.reportsService.exportReportCsv(org.id, query, res);
  }
}
