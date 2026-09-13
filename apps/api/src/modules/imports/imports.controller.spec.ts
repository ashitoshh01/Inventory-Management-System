import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

describe('ImportsController', () => {
  let controller: ImportsController;
  let importsService: {
    generatePreview: jest.Mock;
    createImportJob: jest.Mock;
    listImportJobs: jest.Mock;
    getImportJob: jest.Mock;
    generateErrorCsv: jest.Mock;
  };

  const mockOrg = { id: 'org-1' } as any;
  const mockUser = { id: 'user-1', permissions: ['product.create', 'stock.mutate'] };

  beforeEach(async () => {
    importsService = {
      generatePreview: jest.fn(),
      createImportJob: jest.fn(),
      listImportJobs: jest.fn(),
      getImportJob: jest.fn(),
      generateErrorCsv: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [{ provide: ImportsService, useValue: importsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ImportsController>(ImportsController);
  });

    const mockReq = {
      activeMembership: {
        role: {
          permissions: [
            { permission: { action: 'product.create' } },
            { permission: { action: 'stock.mutate' } },
          ],
        },
      },
    } as any;

  describe('preview', () => {
    it('throws BadRequestException if no file is provided', async () => {
      await expect(
        controller.preview(mockOrg, mockUser, mockReq, undefined, { type: 'PRODUCT' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls importsService.generatePreview with file and dto parameters', async () => {
      const mockFile = {
        originalname: 'test.csv',
        size: 100,
        mimetype: 'text/csv',
        buffer: Buffer.from('sku,name\nP-1,Item'),
      } as any;

      importsService.generatePreview.mockResolvedValue({ totalRows: 1, validRows: 1 });

      const res = await controller.preview(mockOrg, mockUser, mockReq, mockFile, {
        type: 'PRODUCT',
        mode: 'CREATE',
      });

      expect(importsService.generatePreview).toHaveBeenCalledWith(
        'org-1',
        'PRODUCT',
        expect.objectContaining({ originalname: 'test.csv' }),
        'CREATE',
      );
      expect(res).toEqual({ totalRows: 1, validRows: 1 });
    });
  });

  describe('createJob', () => {
    it('calls importsService.createImportJob and returns job dto', async () => {
      const mockFile = {
        originalname: 'test.csv',
        size: 100,
        mimetype: 'text/csv',
        buffer: Buffer.from('sku,name\nP-1,Item'),
      } as any;

      importsService.createImportJob.mockResolvedValue({ id: 'job-1', status: 'PENDING' });

      const res = await controller.createJob(mockOrg, mockUser, mockReq, mockFile, {
        type: 'PRODUCT',
        mode: 'CREATE',
      });

      expect(importsService.createImportJob).toHaveBeenCalledWith(
        'org-1',
        'user-1',
        expect.objectContaining({ originalname: 'test.csv' }),
        { type: 'PRODUCT', mode: 'CREATE' },
      );
      expect(res).toEqual({ id: 'job-1', status: 'PENDING' });
    });
  });

  describe('downloadErrors', () => {
    it('sets CSV attachment headers and streams error CSV', async () => {
      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      importsService.generateErrorCsv.mockResolvedValue({
        csvString: 'Row Number,Column,Error\n2,sku,Invalid',
        filename: 'import-errors-job-1.csv',
      });

      await controller.downloadErrors(mockOrg, 'job-1', mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="import-errors-job-1.csv"',
      );
      expect(mockRes.send).toHaveBeenCalledWith('Row Number,Column,Error\n2,sku,Invalid');
    });
  });
});
