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
import { TransfersService } from './transfers.service';
import {
  CreateStockTransferDto,
  QueryStockTransferDto,
  ReceiveStockTransferDto,
  ShipStockTransferDto,
  UpdateStockTransferDto,
} from './dto/transfer.dto';

@Controller(['transfers', 'inventory/transfers'])
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  /**
   * Create a new stock transfer in DRAFT state.
   */
  @Post()
  @RequirePermissions('stock-transfer.create')
  async create(
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: CreateStockTransferDto,
    @Headers('idempotency-key') headerIdempotencyKey: string | undefined,
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ) {
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

    const { transfer, isIdempotentReplay } = await this.transfersService.create(
      org.id,
      user.id,
      dto,
      effectiveIdempotencyKey,
      req.id,
    );

    if (isIdempotentReplay) {
      res.status(HttpStatus.OK);
      res.setHeader('Idempotent-Replayed', 'true');
    } else {
      res.status(HttpStatus.CREATED);
    }

    return transfer;
  }

  /**
   * List paginated, filtered, and sorted stock transfers.
   */
  @Get()
  @RequirePermissions('stock-transfer.read')
  async findAll(
    @CurrentOrganization() org: Organization,
    @Query() query: QueryStockTransferDto,
    @Req() req: RequestWithId,
  ) {
    return this.transfersService.findAll(org.id, query, req.id);
  }

  /**
   * Get operational transfer metrics and summary.
   */
  @Get('metrics')
  @RequirePermissions('stock-transfer.read')
  async getMetrics(@CurrentOrganization() org: Organization) {
    return this.transfersService.getMetrics(org.id);
  }

  /**
   * Get single stock transfer by ID with lines.
   */
  @Get(':id')
  @RequirePermissions('stock-transfer.read')
  async findOne(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
  ) {
    return this.transfersService.findOne(id, org.id);
  }

  /**
   * Update a DRAFT stock transfer's warehouses, lines, or notes.
   */
  @Patch(':id')
  @RequirePermissions('stock-transfer.update')
  async update(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: UpdateStockTransferDto,
    @Req() req: RequestWithId,
  ) {
    return this.transfersService.update(id, org.id, user.id, dto, req.id);
  }

  /**
   * Delete a DRAFT stock transfer.
   */
  @Delete(':id')
  @RequirePermissions('stock-transfer.delete')
  async delete(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Req() req: RequestWithId,
  ) {
    return this.transfersService.deleteDraft(id, org.id, user.id, req.id);
  }

  /**
   * Transition stock transfer to APPROVED.
   */
  @Post(':id/approve')
  @RequirePermissions('stock-transfer.approve')
  async approve(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Req() req: RequestWithId,
  ) {
    return this.transfersService.approve(id, org.id, user.id, req.id);
  }

  /**
   * Dispatch stock transfer to IN_TRANSIT, deducting inventory from source warehouse.
   */
  @Post(':id/ship')
  @RequirePermissions('stock-transfer.ship')
  async ship(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: ShipStockTransferDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.transfersService.ship(
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
   * Receive stock transfer at destination warehouse, crediting inventory to destination warehouse.
   */
  @Post(':id/receive')
  @RequirePermissions('stock-transfer.receive')
  async receive(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: ReceiveStockTransferDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: RequestWithId,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.transfersService.receive(
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
   * Transition stock transfer to CANCELLED (permitted from DRAFT and APPROVED).
   */
  @Post(':id/cancel')
  @RequirePermissions('stock-transfer.cancel')
  async cancel(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Req() req: RequestWithId,
  ) {
    return this.transfersService.cancel(id, org.id, user.id, req.id);
  }

  /**
   * Get audit timeline for stock transfer.
   */
  @Get(':id/audit-trail')
  @RequirePermissions('stock-transfer.read')
  async getAuditTrail(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
  ) {
    return this.transfersService.getAuditTrail(org.id, id);
  }
}
