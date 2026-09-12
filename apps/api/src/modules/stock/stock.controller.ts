import {
  Controller,
  Get,
  Post,
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
  NotFoundException,
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
import { StockFoundationService } from './stock-foundation.service';
import { StockMutationService } from './stock-mutation.service';
import { CreateStockMutationDto, QueryStockBalanceDto, QueryStockLedgerDto } from './dto/stock.dto';
import { StockBalanceNotFoundException } from './stock.errors';

@Controller('stock')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard)
export class StockController {
  constructor(
    private readonly stockFoundationService: StockFoundationService,
    private readonly stockMutationService: StockMutationService,
  ) {}

  /**
   * List paginated, filtered, and sorted stock balances.
   */
  @Get('balances')
  @RequirePermissions('stock.read')
  async listBalances(
    @CurrentOrganization() org: Organization,
    @Query() query: QueryStockBalanceDto,
    @Req() req: RequestWithId,
  ) {
    return this.stockFoundationService.findPaginatedBalances(org.id, query, req.id);
  }

  /**
   * Get all stock balances for a given product within the active organization.
   * Static/nested route registered before parameterized :id route.
   */
  @Get('balances/product/:productId')
  @RequirePermissions('stock.read')
  async getBalancesByProduct(
    @Param(
      'productId',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }),
    )
    productId: string,
    @CurrentOrganization() org: Organization,
  ) {
    return this.stockFoundationService.findByProduct(org.id, productId);
  }

  /**
   * Get all stock balances for a given warehouse within the active organization.
   * Static/nested route registered before parameterized :id route.
   */
  @Get('balances/warehouse/:warehouseId')
  @RequirePermissions('stock.read')
  async getBalancesByWarehouse(
    @Param(
      'warehouseId',
      new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }),
    )
    warehouseId: string,
    @CurrentOrganization() org: Organization,
  ) {
    return this.stockFoundationService.findByWarehouse(org.id, warehouseId);
  }

  /**
   * Get stock balance detail by balance ID.
   */
  @Get('balances/:id')
  @RequirePermissions('stock.read')
  async getBalanceById(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
  ) {
    const balance = await this.stockFoundationService.findById(org.id, id);
    if (!balance) {
      throw new StockBalanceNotFoundException();
    }
    return balance;
  }

  /**
   * List paginated, filtered, and sorted immutable stock ledger entries.
   */
  @Get('ledger')
  @RequirePermissions('stock.read')
  async listLedger(
    @CurrentOrganization() org: Organization,
    @Query() query: QueryStockLedgerDto,
    @Req() req: RequestWithId,
  ) {
    return this.stockFoundationService.findPaginatedLedger(org.id, query, req.id);
  }

  /**
   * Get immutable stock ledger entry detail by ledger ID.
   */
  @Get('ledger/:id')
  @RequirePermissions('stock.read')
  async getLedgerById(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST, version: '4' }))
    id: string,
    @CurrentOrganization() org: Organization,
  ) {
    const entry = await this.stockFoundationService.findLedgerById(org.id, id);
    if (!entry) {
      throw new NotFoundException('Stock ledger entry not found');
    }
    return entry;
  }

  /**
   * Execute transactional stock mutation.
   * Thin controller delegating all domain invariants to StockMutationService.
   */
  @Post('mutations')
  @RequirePermissions('stock.mutate')
  async mutate(
    @CurrentOrganization() org: Organization,
    @CurrentUser() user: User,
    @Body() dto: CreateStockMutationDto,
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

    // 2. Delegate to authoritative StockMutationService
    const result = await this.stockMutationService.mutateStock({
      organizationId: org.id,
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      type: dto.type,
      quantityDelta: dto.quantityDelta,
      idempotencyKey: effectiveIdempotencyKey,
      referenceType: dto.referenceType,
      referenceId: dto.referenceId,
      metadata: dto.metadata,
      actorUserId: user.id,
      requestId: req.id,
    });

    // 3. Set HTTP status: 201 Created for new mutations, 200 OK for idempotent replays
    if (result.isIdempotentReplay) {
      res.status(HttpStatus.OK);
    } else {
      res.status(HttpStatus.CREATED);
    }

    // 4. Return client response envelope
    return {
      balance: result.balance,
      ledgerEntry: result.ledgerEntry,
      mutation: {
        type: result.ledgerEntry.type,
        idempotencyKey: result.ledgerEntry.idempotencyKey ?? undefined,
      },
      isIdempotentReplay: result.isIdempotentReplay,
    };
  }
}
