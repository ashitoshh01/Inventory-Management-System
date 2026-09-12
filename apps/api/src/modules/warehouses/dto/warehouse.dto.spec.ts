import 'reflect-metadata';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { CreateWarehouseDto, UpdateWarehouseDto, QueryWarehouseDto } from './warehouse.dto';

describe('Warehouse DTO Validation (Unit)', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  describe('CreateWarehouseDto', () => {
    it('should validate and transform a valid payload with whitespace trimming and uppercase code', async () => {
      const raw = {
        name: '  Main Distribution Center  ',
        code: '  wh-main  ',
        description: '  Primary warehouse hub  ',
        addressLine1: '  100 Industrial Rd  ',
        addressLine2: '  Suite 200  ',
        city: '  Mumbai  ',
        state: '  Maharashtra  ',
        postalCode: '  400001  ',
        country: '  India  ',
        status: 'ACTIVE',
        isDefault: true,
      };

      const result = (await validationPipe.transform(raw, {
        type: 'body',
        metatype: CreateWarehouseDto,
      })) as CreateWarehouseDto;

      expect(result.name).toBe('Main Distribution Center');
      expect(result.code).toBe('WH-MAIN');
      expect(result.description).toBe('Primary warehouse hub');
      expect(result.addressLine1).toBe('100 Industrial Rd');
      expect(result.addressLine2).toBe('Suite 200');
      expect(result.city).toBe('Mumbai');
      expect(result.state).toBe('Maharashtra');
      expect(result.postalCode).toBe('400001');
      expect(result.country).toBe('India');
      expect(result.status).toBe('ACTIVE');
      expect(result.isDefault).toBe(true);
    });

    it('should accept minimal valid payload without optional fields', async () => {
      const raw = {
        name: 'Secondary Depot',
        code: 'WH-DEPOT-2',
      };

      const result = (await validationPipe.transform(raw, {
        type: 'body',
        metatype: CreateWarehouseDto,
      })) as CreateWarehouseDto;

      expect(result.name).toBe('Secondary Depot');
      expect(result.code).toBe('WH-DEPOT-2');
      expect(result.description).toBeUndefined();
      expect(result.status).toBeUndefined();
      expect(result.isDefault).toBeUndefined();
    });

    it('should reject missing name', async () => {
      const raw = {
        code: 'WH-TEST',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty or whitespace name', async () => {
      const raw = {
        name: '   ',
        code: 'WH-TEST',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject name shorter than 2 characters', async () => {
      const raw = {
        name: 'A',
        code: 'WH-TEST',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject name longer than 100 characters', async () => {
      const raw = {
        name: 'A'.repeat(101),
        code: 'WH-TEST',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject missing code', async () => {
      const raw = {
        name: 'Test Warehouse',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject code containing special unsupported characters', async () => {
      const raw = {
        name: 'Test Warehouse',
        code: 'WH@MAIN#1!',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject code shorter than 2 characters', async () => {
      const raw = {
        name: 'Test Warehouse',
        code: 'W',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject code longer than 50 characters', async () => {
      const raw = {
        name: 'Test Warehouse',
        code: 'W'.repeat(51),
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid status', async () => {
      const raw = {
        name: 'Test Warehouse',
        code: 'WH-TEST',
        status: 'ARCHIVED',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject injected organizationId or id (non-whitelisted fields)', async () => {
      const raw = {
        name: 'Test Warehouse',
        code: 'WH-TEST',
        organizationId: 'malicious-org-id',
        id: 'malicious-id',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('UpdateWarehouseDto', () => {
    it('should validate partial update payload', async () => {
      const raw = {
        name: '  Updated Warehouse Name  ',
        isDefault: true,
      };

      const result = (await validationPipe.transform(raw, {
        type: 'body',
        metatype: UpdateWarehouseDto,
      })) as UpdateWarehouseDto;

      expect(result.name).toBe('Updated Warehouse Name');
      expect(result.isDefault).toBe(true);
      expect(result.code).toBeUndefined();
    });

    it('should reject empty name if provided', async () => {
      const raw = {
        name: '  ',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: UpdateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty code if provided', async () => {
      const raw = {
        code: '   ',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: UpdateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid status on update', async () => {
      const raw = {
        status: 'DELETED',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: UpdateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-whitelisted organizationId in update payload', async () => {
      const raw = {
        organizationId: 'injected-org',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: UpdateWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('QueryWarehouseDto', () => {
    it('should parse and transform pagination, search, and sort parameters', async () => {
      const raw = {
        page: '2',
        limit: '15',
        search: '  central  ',
        status: 'ACTIVE',
        sortBy: 'name',
        sortOrder: 'asc',
      };

      const result = (await validationPipe.transform(raw, {
        type: 'query',
        metatype: QueryWarehouseDto,
      })) as QueryWarehouseDto;

      expect(result.page).toBe(2);
      expect(result.limit).toBe(15);
      expect(result.search).toBe('central');
      expect(result.status).toBe('ACTIVE');
      expect(result.sortBy).toBe('name');
      expect(result.sortOrder).toBe('asc');
    });

    it('should reject negative page number', async () => {
      const raw = {
        page: '-1',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'query',
          metatype: QueryWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject limit greater than 100', async () => {
      const raw = {
        limit: '101',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'query',
          metatype: QueryWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid sort field', async () => {
      const raw = {
        sortBy: 'injected_column_drop_table',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'query',
          metatype: QueryWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid sort order', async () => {
      const raw = {
        sortOrder: 'sideways',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'query',
          metatype: QueryWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid status filter', async () => {
      const raw = {
        status: 'INVALID_STATUS',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'query',
          metatype: QueryWarehouseDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
