import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { StockController } from './stock.controller';
import { StockFoundationService } from './stock-foundation.service';
import { StockMutationService } from './stock-mutation.service';
import { CreateStockMutationDto, QueryStockBalanceDto, QueryStockLedgerDto } from './dto/stock.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Organization, User } from '@repo/database';
import { RequestWithId } from '../../common/middleware/correlation-id.middleware';
import { StockBalanceNotFoundException } from './stock.errors';

describe('StockController (Unit)', () => {
  let controller: StockController;
  let foundationService: {
    findPaginatedBalances: jest.Mock;
    findByProduct: jest.Mock;
    findByWarehouse: jest.Mock;
    findById: jest.Mock;
    findPaginatedLedger: jest.Mock;
    findLedgerById: jest.Mock;
  };
  let mutationService: {
    mutateStock: jest.Mock;
  };

  const mockOrg: Organization = {
    id: 'org-uuid-1',
    slug: 'acme-corp',
    name: 'Acme Corp',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'user@example.com',
    passwordHash: 'hashed-pw',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReq = { id: 'req-corr-999' } as RequestWithId;

  let mockResponse: {
    status: jest.Mock;
  };

  beforeEach(async () => {
    foundationService = {
      findPaginatedBalances: jest.fn(),
      findByProduct: jest.fn(),
      findByWarehouse: jest.fn(),
      findById: jest.fn(),
      findPaginatedLedger: jest.fn(),
      findLedgerById: jest.fn(),
    };

    mutationService = {
      mutateStock: jest.fn(),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StockController],
      providers: [
        { provide: StockFoundationService, useValue: foundationService },
        { provide: StockMutationService, useValue: mutationService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StockController>(StockController);
  });

  describe('listBalances', () => {
    it('delegates to StockFoundationService.findPaginatedBalances', async () => {
      const query = new QueryStockBalanceDto();
      const mockResult = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      foundationService.findPaginatedBalances.mockResolvedValue(mockResult);

      const result = await controller.listBalances(mockOrg, query, mockReq);

      expect(foundationService.findPaginatedBalances).toHaveBeenCalledWith(
        mockOrg.id,
        query,
        mockReq.id,
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('getBalancesByProduct', () => {
    it('delegates to StockFoundationService.findByProduct', async () => {
      const prodId = 'prod-uuid-1';
      const mockBalances = [
        {
          id: 'bal-1',
          organizationId: mockOrg.id,
          productId: prodId,
          warehouseId: 'wh-1',
          quantity: '10.0000',
        },
      ];
      foundationService.findByProduct.mockResolvedValue(mockBalances);

      const result = await controller.getBalancesByProduct(prodId, mockOrg);

      expect(foundationService.findByProduct).toHaveBeenCalledWith(mockOrg.id, prodId);
      expect(result).toBe(mockBalances);
    });
  });

  describe('getBalancesByWarehouse', () => {
    it('delegates to StockFoundationService.findByWarehouse', async () => {
      const whId = 'wh-uuid-1';
      const mockBalances = [
        {
          id: 'bal-1',
          organizationId: mockOrg.id,
          productId: 'prod-1',
          warehouseId: whId,
          quantity: '5.0000',
        },
      ];
      foundationService.findByWarehouse.mockResolvedValue(mockBalances);

      const result = await controller.getBalancesByWarehouse(whId, mockOrg);

      expect(foundationService.findByWarehouse).toHaveBeenCalledWith(mockOrg.id, whId);
      expect(result).toBe(mockBalances);
    });
  });

  describe('getBalanceById', () => {
    it('returns balance if found in active organization', async () => {
      const balId = 'bal-uuid-1';
      const mockBalance = {
        id: balId,
        organizationId: mockOrg.id,
        productId: 'p1',
        warehouseId: 'w1',
        quantity: '20.0000',
      };
      foundationService.findById.mockResolvedValue(mockBalance);

      const result = await controller.getBalanceById(balId, mockOrg);

      expect(foundationService.findById).toHaveBeenCalledWith(mockOrg.id, balId);
      expect(result).toBe(mockBalance);
    });

    it('throws StockBalanceNotFoundException if not found', async () => {
      foundationService.findById.mockResolvedValue(null);

      await expect(controller.getBalanceById('missing-bal', mockOrg)).rejects.toThrow(
        StockBalanceNotFoundException,
      );
    });
  });

  describe('listLedger', () => {
    it('delegates to StockFoundationService.findPaginatedLedger', async () => {
      const query = new QueryStockLedgerDto();
      const mockResult = {
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      foundationService.findPaginatedLedger.mockResolvedValue(mockResult);

      const result = await controller.listLedger(mockOrg, query, mockReq);

      expect(foundationService.findPaginatedLedger).toHaveBeenCalledWith(
        mockOrg.id,
        query,
        mockReq.id,
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('getLedgerById', () => {
    it('returns ledger entry if found in active organization', async () => {
      const ledgerId = 'ledger-uuid-1';
      const mockEntry = {
        id: ledgerId,
        organizationId: mockOrg.id,
        type: 'RECEIPT',
        quantityDelta: '10.0000',
      };
      foundationService.findLedgerById.mockResolvedValue(mockEntry);

      const result = await controller.getLedgerById(ledgerId, mockOrg);

      expect(foundationService.findLedgerById).toHaveBeenCalledWith(mockOrg.id, ledgerId);
      expect(result).toBe(mockEntry);
    });

    it('throws NotFoundException if ledger entry not found', async () => {
      foundationService.findLedgerById.mockResolvedValue(null);

      await expect(controller.getLedgerById('missing-ledger', mockOrg)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('mutate', () => {
    const dto: CreateStockMutationDto = {
      productId: 'prod-uuid-1',
      warehouseId: 'wh-uuid-1',
      type: 'RECEIPT',
      quantityDelta: '50.0000',
      idempotencyKey: 'IDEMP-1',
      referenceType: 'PO',
      referenceId: 'PO-100',
    };

    it('executes new mutation and sets 201 Created', async () => {
      mutationService.mutateStock.mockResolvedValue({
        balance: { id: 'bal-1', quantity: '50.0000' },
        ledgerEntry: {
          id: 'led-1',
          type: 'RECEIPT',
          quantityDelta: '50.0000',
          idempotencyKey: 'IDEMP-1',
        },
        isIdempotentReplay: false,
      });

      const result = await controller.mutate(
        mockOrg,
        mockUser,
        dto,
        'IDEMP-1',
        mockReq,
        mockResponse as unknown as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mutationService.mutateStock).toHaveBeenCalledWith({
        organizationId: mockOrg.id,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        type: dto.type,
        quantityDelta: dto.quantityDelta,
        idempotencyKey: 'IDEMP-1',
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        metadata: undefined,
        actorUserId: mockUser.id,
        requestId: mockReq.id,
      });
      expect(result.balance.quantity).toBe('50.0000');
      expect(result.isIdempotentReplay).toBe(false);
    });

    it('handles idempotent replay and sets 200 OK', async () => {
      mutationService.mutateStock.mockResolvedValue({
        balance: { id: 'bal-1', quantity: '50.0000' },
        ledgerEntry: {
          id: 'led-1',
          type: 'RECEIPT',
          quantityDelta: '50.0000',
          idempotencyKey: 'IDEMP-1',
        },
        isIdempotentReplay: true,
      });

      const result = await controller.mutate(
        mockOrg,
        mockUser,
        dto,
        'IDEMP-1',
        mockReq,
        mockResponse as unknown as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(result.isIdempotentReplay).toBe(true);
    });

    it('rejects mismatch between header and body idempotency keys with 400 Bad Request', async () => {
      await expect(
        controller.mutate(
          mockOrg,
          mockUser,
          dto,
          'DIFFERENT-HEADER-KEY',
          mockReq,
          mockResponse as unknown as Response,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects header idempotency key with invalid characters with 400 Bad Request', async () => {
      const { idempotencyKey: _discard, ...dtoNoKey } = dto;
      await expect(
        controller.mutate(
          mockOrg,
          mockUser,
          dtoNoKey,
          'invalid key @#$%',
          mockReq,
          mockResponse as unknown as Response,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
