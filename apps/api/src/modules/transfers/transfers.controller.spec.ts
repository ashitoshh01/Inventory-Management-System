import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { User, Organization } from '@repo/database';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequestWithId } from '../../common/middleware/correlation-id.middleware';
import { StockTransferDto } from '@repo/types';
import { QueryStockTransferDto } from './dto/transfer.dto';

describe('TransfersController (Unit)', () => {
  let controller: TransfersController;
  let service: jest.Mocked<TransfersService>;

  const mockOrg: Organization = {
    id: 'org-1',
    name: 'Test Org',
    slug: 'test-org',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser: User = {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hash',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReq: RequestWithId = {
    id: 'req-123',
  } as unknown as RequestWithId;

  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransfersController],
      providers: [
        {
          provide: TransfersService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            getMetrics: jest.fn(),
            update: jest.fn(),
            deleteDraft: jest.fn(),
            approve: jest.fn(),
            ship: jest.fn(),
            receive: jest.fn(),
            cancel: jest.fn(),
            getAuditTrail: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TransfersController>(TransfersController);
    service = module.get(TransfersService);
  });

  describe('create', () => {
    it('creates a new transfer and sets 201 Created', async () => {
      const dto = {
        transferNumber: 'TR-1',
        sourceWarehouseId: 'wh-1',
        destinationWarehouseId: 'wh-2',
        lines: [{ productId: 'prod-1', quantity: '5.0000' }],
      };

      const mockTransfer = { id: 'tr-1', transferNumber: 'TR-1' } as StockTransferDto;
      service.create.mockResolvedValue({ transfer: mockTransfer, isIdempotentReplay: false });

      const res = mockResponse();
      const result = await controller.create(mockOrg, mockUser, dto, undefined, mockReq, res);

      expect(service.create).toHaveBeenCalledWith(
        mockOrg.id,
        mockUser.id,
        dto,
        undefined,
        mockReq.id,
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(result).toEqual(mockTransfer);
    });

    it('sets 200 OK and Idempotent-Replayed header on replay', async () => {
      const dto = {
        transferNumber: 'TR-1',
        sourceWarehouseId: 'wh-1',
        destinationWarehouseId: 'wh-2',
        lines: [{ productId: 'prod-1', quantity: '5.0000' }],
      };

      const mockTransfer = { id: 'tr-1', transferNumber: 'TR-1' } as StockTransferDto;
      service.create.mockResolvedValue({ transfer: mockTransfer, isIdempotentReplay: true });

      const res = mockResponse();
      const result = await controller.create(mockOrg, mockUser, dto, 'idem-key-1', mockReq, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.setHeader).toHaveBeenCalledWith('Idempotent-Replayed', 'true');
      expect(result).toEqual(mockTransfer);
    });

    it('rejects when header and body idempotency keys do not match', async () => {
      const dto = {
        transferNumber: 'TR-1',
        sourceWarehouseId: 'wh-1',
        destinationWarehouseId: 'wh-2',
        lines: [{ productId: 'prod-1', quantity: '5.0000' }],
        idempotencyKey: 'body-key',
      };

      const res = mockResponse();
      await expect(
        controller.create(mockOrg, mockUser, dto, 'header-key', mockReq, res),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('delegates query parameters to service', async () => {
      const query = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      } as unknown as QueryStockTransferDto;
      const mockResult = {
        data: [],
        meta: {
          page: 1,
          limit: 10,
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
      service.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockOrg, query, mockReq);
      expect(service.findAll).toHaveBeenCalledWith(mockOrg.id, query, mockReq.id);
      expect(result).toBe(mockResult);
    });
  });

  describe('findOne', () => {
    it('delegates ID lookup to service', async () => {
      const mockTransfer = { id: 'tr-1' } as StockTransferDto;
      service.findOne.mockResolvedValue(mockTransfer);

      const result = await controller.findOne('tr-1', mockOrg);
      expect(service.findOne).toHaveBeenCalledWith('tr-1', mockOrg.id);
      expect(result).toBe(mockTransfer);
    });
  });

  describe('approve', () => {
    it('delegates approve to service', async () => {
      const mockTransfer = { id: 'tr-1', status: 'APPROVED' } as StockTransferDto;
      service.approve.mockResolvedValue(mockTransfer);

      const result = await controller.approve('tr-1', mockOrg, mockUser, mockReq);
      expect(service.approve).toHaveBeenCalledWith('tr-1', mockOrg.id, mockUser.id, mockReq.id);
      expect(result).toBe(mockTransfer);
    });
  });

  describe('ship', () => {
    it('delegates ship to service with idempotency handling', async () => {
      const shipResult = {
        transferId: 'tr-1',
        status: 'IN_TRANSIT' as const,
        shippedAt: new Date().toISOString(),
        isIdempotentReplay: false,
      };
      service.ship.mockResolvedValue(shipResult);

      const res = mockResponse();
      const result = await controller.ship(
        'tr-1',
        mockOrg,
        mockUser,
        {},
        'idem-ship',
        mockReq,
        res,
      );

      expect(service.ship).toHaveBeenCalledWith(
        'tr-1',
        mockOrg.id,
        mockUser.id,
        {},
        'idem-ship',
        mockReq.id,
      );
      expect(result).toBe(shipResult);
    });
  });

  describe('receive', () => {
    it('delegates receive to service with idempotency handling', async () => {
      const receiveResult = {
        transferId: 'tr-1',
        status: 'RECEIVED' as const,
        receivedAt: new Date().toISOString(),
        isIdempotentReplay: false,
      };
      service.receive.mockResolvedValue(receiveResult);

      const res = mockResponse();
      const result = await controller.receive(
        'tr-1',
        mockOrg,
        mockUser,
        {},
        'idem-recv',
        mockReq,
        res,
      );

      expect(service.receive).toHaveBeenCalledWith(
        'tr-1',
        mockOrg.id,
        mockUser.id,
        {},
        'idem-recv',
        mockReq.id,
      );
      expect(result).toBe(receiveResult);
    });
  });

  describe('cancel', () => {
    it('delegates cancel to service', async () => {
      const mockTransfer = { id: 'tr-1', status: 'CANCELLED' } as StockTransferDto;
      service.cancel.mockResolvedValue(mockTransfer);

      const result = await controller.cancel('tr-1', mockOrg, mockUser, mockReq);
      expect(service.cancel).toHaveBeenCalledWith('tr-1', mockOrg.id, mockUser.id, mockReq.id);
      expect(result).toBe(mockTransfer);
    });
  });
});
