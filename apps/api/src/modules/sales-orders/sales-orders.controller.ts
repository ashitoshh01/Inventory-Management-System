import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { User, Organization } from '@repo/database';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SalesOrdersService } from './sales-orders.service';
import {
  CreateSalesOrderDto,
  UpdateSalesOrderDto,
  CancelSalesOrderDto,
  SalesOrderQueryDto,
} from './dto/sales-order.dto';
import {
  SalesOrderDto,
  SalesOrderMetricsDto,
  SalesOrderAuditEventDto,
  PaginatedResponse,
} from '@repo/types';
import {
  SalesOrderMutationResult,
  SalesOrderFulfillmentResult,
} from './sales-orders.types';

@Controller('sales-orders')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class SalesOrdersController {
  constructor(private readonly salesOrdersService: SalesOrdersService) {}

  @Post()
  @RequirePermissions('sales-order.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrganization() org: Organization,
    @Body() dto: CreateSalesOrderDto,
    @CurrentUser() user: User,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
  ): Promise<SalesOrderMutationResult> {
    return this.salesOrdersService.create(org.id, dto, user?.id, idempotencyKeyHeader);
  }

  @Get('metrics')
  @RequirePermissions('sales-order.read')
  async getMetrics(
    @CurrentOrganization() org: Organization,
  ): Promise<SalesOrderMetricsDto> {
    return this.salesOrdersService.getMetrics(org.id);
  }

  @Get()
  @RequirePermissions('sales-order.read')
  async findAll(
    @CurrentOrganization() org: Organization,
    @Query() query: SalesOrderQueryDto,
  ): Promise<PaginatedResponse<SalesOrderDto>> {
    return this.salesOrdersService.findAll(org.id, query);
  }

  @Get(':id')
  @RequirePermissions('sales-order.read')
  async findOne(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<SalesOrderDto> {
    return this.salesOrdersService.findOne(org.id, id);
  }

  @Get(':id/audit-trail')
  @RequirePermissions('sales-order.read')
  async getAuditTrail(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<SalesOrderAuditEventDto[]> {
    return this.salesOrdersService.getAuditTrail(org.id, id);
  }

  @Patch(':id')
  @RequirePermissions('sales-order.update')
  async update(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateSalesOrderDto,
    @CurrentUser() user: User,
  ): Promise<SalesOrderDto> {
    return this.salesOrdersService.update(org.id, id, dto, user?.id);
  }

  @Delete(':id')
  @RequirePermissions('sales-order.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.salesOrdersService.remove(org.id, id, user?.id);
  }

  @Post(':id/submit')
  @RequirePermissions('sales-order.submit')
  @HttpCode(HttpStatus.OK)
  async submit(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: User,
  ): Promise<SalesOrderDto> {
    return this.salesOrdersService.submit(org.id, id, user?.id);
  }

  @Post(':id/approve')
  @RequirePermissions('sales-order.approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: User,
  ): Promise<SalesOrderDto> {
    return this.salesOrdersService.approve(org.id, id, user?.id);
  }

  @Post(':id/confirm')
  @RequirePermissions('sales-order.approve')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: User,
  ): Promise<SalesOrderDto> {
    return this.salesOrdersService.confirm(org.id, id, user?.id);
  }

  @Post(':id/fulfill')
  @RequirePermissions('sales-order.fulfill')
  @HttpCode(HttpStatus.OK)
  async fulfill(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: User,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<SalesOrderFulfillmentResult> {
    return this.salesOrdersService.fulfill(org.id, id, user?.id, idempotencyKey);
  }

  @Post(':id/cancel')
  @RequirePermissions('sales-order.cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelSalesOrderDto,
    @CurrentUser() user: User,
  ): Promise<SalesOrderDto> {
    return this.salesOrdersService.cancel(org.id, id, dto, user?.id);
  }
}

/**
 * Dual-mounted route alias under `/sales` to fulfill docs/api.md contracts.
 */
@Controller('sales')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class SalesController {
  constructor(private readonly salesOrdersService: SalesOrdersService) {}

  @Post()
  @RequirePermissions('sales-order.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentOrganization() org: Organization,
    @Body() dto: CreateSalesOrderDto,
    @CurrentUser() user: User,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
  ): Promise<SalesOrderMutationResult> {
    return this.salesOrdersService.create(org.id, dto, user?.id, idempotencyKeyHeader);
  }

  @Get()
  @RequirePermissions('sales-order.read')
  async findAll(
    @CurrentOrganization() org: Organization,
    @Query() query: SalesOrderQueryDto,
  ): Promise<PaginatedResponse<SalesOrderDto>> {
    return this.salesOrdersService.findAll(org.id, query);
  }

  @Get(':id')
  @RequirePermissions('sales-order.read')
  async findOne(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<SalesOrderDto> {
    return this.salesOrdersService.findOne(org.id, id);
  }

  @Post(':id/confirm')
  @RequirePermissions('sales-order.approve')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentUser() user: User,
  ): Promise<SalesOrderDto> {
    return this.salesOrdersService.confirm(org.id, id, user?.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('sales-order.cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentOrganization() org: Organization,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: CancelSalesOrderDto,
    @CurrentUser() user: User,
  ): Promise<SalesOrderDto> {
    return this.salesOrdersService.cancel(org.id, id, dto, user?.id);
  }
}
