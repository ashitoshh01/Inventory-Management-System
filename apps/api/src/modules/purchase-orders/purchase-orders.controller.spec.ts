import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
  QueryPurchaseOrderDto,
} from './dto/purchase-order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Organization, User } from '@repo/database';
import { RequestWithId } from '../../common/middleware/correlation-id.middleware';

describe('PurchaseOrdersController (Unit)', () => {
  let controller: PurchaseOrdersController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    deleteDraft: jest.Mock;
    submit: jest.Mock;
    approve: jest.Mock;
    cancel: jest.Mock;
    getMetrics: jest.Mock;
    reconcile: jest.Mock;
    getAuditTrail: jest.Mock;
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
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      deleteDraft: jest.fn(),
      submit: jest.fn(),
      approve: jest.fn(),
      cancel: jest.fn(),
      getMetrics: jest.fn(),
      reconcile: jest.fn(),
      getAuditTrail: jest.fn(),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseOrdersController],
      providers: [{ provide: PurchaseOrdersService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PurchaseOrdersController>(PurchaseOrdersController);
  });

  describe('create', () => {
    const dto: CreatePurchaseOrderDto = {
      purchaseOrderNumber: 'PO-2026-001',
      supplierName: 'Acme Supplies',
      warehouseId: 'wh-uuid-1',
      idempotencyKey: 'IDEMP-1',
      lines: [
        {
          productId: 'prod-uuid-1',
          quantity: '10.0000',
          unitPrice: '50.0000',
        },
      ],
    };

    it('creates new purchase order and sets 201 Created', async () => {
      const mockOrder = { id: 'po-1', purchaseOrderNumber: 'PO-2026-001' };
      service.create.mockResolvedValue({
        order: mockOrder,
        isIdempotentReplay: false,
      });

      const result = await controller.create(
        mockOrg,
        mockUser,
        dto,
        'IDEMP-1',
        mockReq,
        mockResponse as unknown as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(service.create).toHaveBeenCalledWith(
        mockOrg.id,
        mockUser.id,
        dto,
        'IDEMP-1',
        mockReq.id,
      );
      expect(result).toBe(mockOrder);
    });

    it('handles idempotent replay and sets 200 OK', async () => {
      const mockOrder = { id: 'po-1', purchaseOrderNumber: 'PO-2026-001' };
      service.create.mockResolvedValue({
        order: mockOrder,
        isIdempotentReplay: true,
      });

      const result = await controller.create(
        mockOrg,
        mockUser,
        dto,
        'IDEMP-1',
        mockReq,
        mockResponse as unknown as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(result).toBe(mockOrder);
    });

    it('rejects mismatch between header and body idempotency keys with 400 Bad Request', async () => {
      await expect(
        controller.create(
          mockOrg,
          mockUser,
          dto,
          'MISMATCHED-HEADER',
          mockReq,
          mockResponse as unknown as Response,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects idempotency keys exceeding 100 characters', async () => {
      const longKey = 'a'.repeat(101);
      const { idempotencyKey: _discard1, ...dtoNoKey } = dto;
      await expect(
        controller.create(
          mockOrg,
          mockUser,
          dtoNoKey,
          longKey,
          mockReq,
          mockResponse as unknown as Response,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects idempotency keys with invalid special characters', async () => {
      const { idempotencyKey: _discard2, ...dtoNoKey } = dto;
      await expect(
        controller.create(
          mockOrg,
          mockUser,
          dtoNoKey,
          'invalid key @#$!',
          mockReq,
          mockResponse as unknown as Response,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('delegates to PurchaseOrdersService.findAll', async () => {
      const query = new QueryPurchaseOrderDto();
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
      service.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockOrg, query, mockReq);
      expect(service.findAll).toHaveBeenCalledWith(mockOrg.id, query, mockReq.id);
      expect(result).toBe(mockResult);
    });
  });

  describe('findOne', () => {
    it('delegates to PurchaseOrdersService.findOne', async () => {
      const mockOrder = { id: 'po-1' };
      service.findOne.mockResolvedValue(mockOrder);

      const result = await controller.findOne('po-1', mockOrg);
      expect(service.findOne).toHaveBeenCalledWith('po-1', mockOrg.id);
      expect(result).toBe(mockOrder);
    });
  });

  describe('update', () => {
    it('delegates to PurchaseOrdersService.update', async () => {
      const updateDto: UpdatePurchaseOrderDto = { supplierName: 'New Name' };
      const mockOrder = { id: 'po-1', supplierName: 'New Name' };
      service.update.mockResolvedValue(mockOrder);

      const result = await controller.update('po-1', mockOrg, mockUser, updateDto, mockReq);
      expect(service.update).toHaveBeenCalledWith(
        'po-1',
        mockOrg.id,
        mockUser.id,
        updateDto,
        mockReq.id,
      );
      expect(result).toBe(mockOrder);
    });
  });

  describe('delete', () => {
    it('delegates to PurchaseOrdersService.deleteDraft', async () => {
      service.deleteDraft.mockResolvedValue({ message: 'Deleted', id: 'po-1' });

      const result = await controller.delete('po-1', mockOrg, mockUser, mockReq);
      expect(service.deleteDraft).toHaveBeenCalledWith('po-1', mockOrg.id, mockUser.id, mockReq.id);
      expect(result).toEqual({ message: 'Deleted', id: 'po-1' });
    });
  });

  describe('lifecycle endpoints', () => {
    it('submit delegates to service.submit', async () => {
      const mockOrder = { id: 'po-1', status: 'SUBMITTED' };
      service.submit.mockResolvedValue(mockOrder);

      const result = await controller.submit('po-1', mockOrg, mockUser, mockReq);
      expect(service.submit).toHaveBeenCalledWith('po-1', mockOrg.id, mockUser.id, mockReq.id);
      expect(result).toBe(mockOrder);
    });

    it('approve delegates to service.approve', async () => {
      const mockOrder = { id: 'po-1', status: 'APPROVED' };
      service.approve.mockResolvedValue(mockOrder);

      const result = await controller.approve('po-1', mockOrg, mockUser, mockReq);
      expect(service.approve).toHaveBeenCalledWith('po-1', mockOrg.id, mockUser.id, mockReq.id);
      expect(result).toBe(mockOrder);
    });

    it('cancel delegates to service.cancel', async () => {
      const mockOrder = { id: 'po-1', status: 'CANCELLED' };
      service.cancel.mockResolvedValue(mockOrder);

      const result = await controller.cancel('po-1', mockOrg, mockUser, mockReq);
      expect(service.cancel).toHaveBeenCalledWith('po-1', mockOrg.id, mockUser.id, mockReq.id);
      expect(result).toBe(mockOrder);
    });
  });

  describe('operational endpoints', () => {
    it('getMetrics delegates to service.getMetrics', async () => {
      const mockMetrics = {
        totalOrders: 5,
        statusCounts: {
          DRAFT: 1,
          SUBMITTED: 1,
          APPROVED: 1,
          PARTIALLY_RECEIVED: 1,
          RECEIVED: 1,
          CLOSED: 0,
          CANCELLED: 0,
        },
        totalOrderedQuantity: '100.0000',
        totalReceivedQuantity: '50.0000',
        totalOutstandingQuantity: '50.0000',
        pendingReceivingCount: 2,
        overdueCount: 1,
        recentlyReceivedCount: 1,
      };
      service.getMetrics.mockResolvedValue(mockMetrics);

      const result = await controller.getMetrics(mockOrg);
      expect(service.getMetrics).toHaveBeenCalledWith(mockOrg.id);
      expect(result).toBe(mockMetrics);
    });

    it('getReconciliation delegates to service.reconcile', async () => {
      const mockReconciliation = {
        purchaseOrderId: 'po-1',
        isReconciled: true,
        discrepancies: [],
      };
      service.reconcile.mockResolvedValue(mockReconciliation);

      const result = await controller.getReconciliation('po-1', mockOrg);
      expect(service.reconcile).toHaveBeenCalledWith(mockOrg.id, 'po-1');
      expect(result).toBe(mockReconciliation);
    });

    it('getAuditTrail delegates to service.getAuditTrail', async () => {
      const mockEvents = [{ id: 'evt-1', action: 'purchase-order.created' }];
      service.getAuditTrail.mockResolvedValue(mockEvents);

      const result = await controller.getAuditTrail('po-1', mockOrg);
      expect(service.getAuditTrail).toHaveBeenCalledWith(mockOrg.id, 'po-1');
      expect(result).toBe(mockEvents);
    });
  });
});
