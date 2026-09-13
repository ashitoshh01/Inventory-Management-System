import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Req,
  Res,
  ParseUUIDPipe,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { User, Organization } from '@repo/database';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { RequestWithId } from '../../common/middleware/correlation-id.middleware';
import { PurchaseOrdersService } from './purchase-orders.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  QueryPurchaseOrderDto,
  ReceivePurchaseOrderDto,
} from './dto/purchase-order.dto';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  /**
   * Create a purchase order with lines.
   */
  @Post()
  @RequirePermissions('purchase-order.create')
  async create(
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: CreatePurchaseOrderDto,
    @Headers('idempotency-key') headerIdempotencyKey: string | undefined,
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1. Reconcile header and body idempotency keys
    const trimmedHeaderKey = headerIdempotencyKey?.trim() || undefined;
    const trimmedBodyKey = dto.idempotencyKey?.trim() || undefined;

    if (trimmedHeaderKey && trimmedBodyKey && trimmedHeaderKey !== trimmedBodyKey) {
      throw new BadRequestException(
        'Idempotency-Key header and request body idempotencyKey do not match',
      );
    }

    const effectiveIdempotencyKey = trimmedHeaderKey || trimmedBodyKey;
    if (effectiveIdempotencyKey) {
      if (effectiveIdempotencyKey.length > 100) {
        throw new BadRequestException('Idempotency key cannot exceed 100 characters');
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(effectiveIdempotencyKey)) {
        throw new BadRequestException(
          'Idempotency key can only contain alphanumeric characters, underscores, and hyphens',
        );
      }
    }

    // 2. Authoritative creation via PurchaseOrdersService
    const { order, isIdempotentReplay } = await this.purchaseOrdersService.create(
      org.id,
      user.id,
      dto,
      effectiveIdempotencyKey,
      req.id,
    );

    if (isIdempotentReplay) {
      res.status(HttpStatus.OK);
    } else {
      res.status(HttpStatus.CREATED);
    }

    return order;
  }

  /**
   * List paginated, filtered, and sorted purchase orders.
   */
  @Get()
  @RequirePermissions('purchase-order.read')
  async findAll(
    @CurrentOrganization() org: Organization,
    @Query() query: QueryPurchaseOrderDto,
    @Req() req: RequestWithId,
  ) {
    return this.purchaseOrdersService.findAll(org.id, query, req.id);
  }

  /**
   * Get operational procurement metrics and overview.
   */
  @Get('metrics')
  @RequirePermissions('purchase-order.read')
  async getMetrics(@CurrentOrganization() org: Organization) {
    return this.purchaseOrdersService.getMetrics(org.id);
  }

  /**
   * Get single purchase order by ID.
   */
  @Get(':id')
  @RequirePermissions('purchase-order.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
  ) {
    return this.purchaseOrdersService.findOne(id, org.id);
  }

  /**
   * Update DRAFT purchase order permitted fields or line items.
   */
  @Patch(':id')
  @RequirePermissions('purchase-order.update')
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: UpdatePurchaseOrderDto,
    @Req() req: RequestWithId,
  ) {
    return this.purchaseOrdersService.update(id, org.id, user.id, dto, req.id);
  }

  /**
   * Delete a DRAFT purchase order.
   */
  @Delete(':id')
  @RequirePermissions('purchase-order.delete')
  async delete(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Req() req: RequestWithId,
  ) {
    return this.purchaseOrdersService.deleteDraft(id, org.id, user.id, req.id);
  }

  /**
   * Transition purchase order to SUBMITTED.
   */
  @Post(':id/submit')
  @RequirePermissions('purchase-order.submit')
  async submit(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Req() req: RequestWithId,
  ) {
    return this.purchaseOrdersService.submit(id, org.id, user.id, req.id);
  }

  /**
   * Transition purchase order to APPROVED.
   */
  @Post(':id/approve')
  @RequirePermissions('purchase-order.approve')
  async approve(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Req() req: RequestWithId,
  ) {
    return this.purchaseOrdersService.approve(id, org.id, user.id, req.id);
  }

  /**
   * Transition purchase order to CANCELLED.
   */
  @Post(':id/cancel')
  @RequirePermissions('purchase-order.cancel')
  async cancel(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Req() req: RequestWithId,
  ) {
    return this.purchaseOrdersService.cancel(id, org.id, user.id, req.id);
  }

  /**
   * Receive items against an approved purchase order.
   */
  @Post(':id/receive')
  @RequirePermissions('purchase-order.receive')
  async receive(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: ReceivePurchaseOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.purchaseOrdersService.receive(
      id,
      org.id,
      user.id,
      dto,
      idempotencyKey,
      req.id,
    );

    if (result.isIdempotentReplay) {
      res.setHeader('Idempotent-Replayed', 'true');
    }

    return result;
  }

  /**
   * Get goods receipt history for a purchase order.
   */
  @Get(':id/receipts')
  @RequirePermissions('purchase-order.read')
  async getReceipts(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
  ) {
    return this.purchaseOrdersService.getReceipts(id, org.id);
  }

  /**
   * Cross-checks and reconciles physical receiving vs stock ledger vs PO lines.
   * Strictly read-only verification.
   */
  @Get(':id/reconciliation')
  @RequirePermissions('purchase-order.read')
  async getReconciliation(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
  ) {
    return this.purchaseOrdersService.reconcile(org.id, id);
  }

  /**
   * Get audit history timeline for a purchase order.
   */
  @Get(':id/audit-trail')
  @RequirePermissions('purchase-order.read')
  async getAuditTrail(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
  ) {
    return this.purchaseOrdersService.getAuditTrail(org.id, id);
  }
}
