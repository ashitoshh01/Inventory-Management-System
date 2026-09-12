import 'reflect-metadata';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { CreateProductDto, UpdateProductDto, QueryProductDto } from './product.dto';

describe('Product DTO Validation (Unit)', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const validCategoryId = 'c8e4e937-234b-4ec9-8d76-e88390eb178b';

  describe('CreateProductDto', () => {
    it('should validate and transform a valid payload with whitespace trimming', async () => {
      const raw = {
        sku: '  sku-100  ',
        name: '  Wireless Mouse  ',
        description: '  Ergonomic 2.4GHz mouse  ',
        categoryId: validCategoryId,
        unitOfMeasure: 'UNIT',
        status: 'ACTIVE',
      };

      const result = (await validationPipe.transform(raw, {
        type: 'body',
        metatype: CreateProductDto,
      })) as CreateProductDto;

      expect(result.sku).toBe('sku-100');
      expect(result.name).toBe('Wireless Mouse');
      expect(result.description).toBe('Ergonomic 2.4GHz mouse');
      expect(result.categoryId).toBe(validCategoryId);
      expect(result.unitOfMeasure).toBe('UNIT');
      expect(result.status).toBe('ACTIVE');
    });

    it('should accept valid payload without optional fields', async () => {
      const raw = {
        sku: 'SKU-200',
        name: 'Hammer',
        categoryId: validCategoryId,
      };

      const result = (await validationPipe.transform(raw, {
        type: 'body',
        metatype: CreateProductDto,
      })) as CreateProductDto;

      expect(result.sku).toBe('SKU-200');
      expect(result.name).toBe('Hammer');
      expect(result.description).toBeUndefined();
      expect(result.unitOfMeasure).toBeUndefined();
      expect(result.status).toBeUndefined();
    });

    it('should reject missing SKU', async () => {
      const raw = {
        name: 'Hammer',
        categoryId: validCategoryId,
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateProductDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject missing name', async () => {
      const raw = {
        sku: 'SKU-200',
        categoryId: validCategoryId,
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateProductDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject missing categoryId', async () => {
      const raw = {
        sku: 'SKU-200',
        name: 'Hammer',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateProductDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid categoryId (not a UUIDv4)', async () => {
      const raw = {
        sku: 'SKU-200',
        name: 'Hammer',
        categoryId: 'not-a-uuid',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateProductDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid unitOfMeasure', async () => {
      const raw = {
        sku: 'SKU-200',
        name: 'Hammer',
        categoryId: validCategoryId,
        unitOfMeasure: 'TON',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateProductDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid status', async () => {
      const raw = {
        sku: 'SKU-200',
        name: 'Hammer',
        categoryId: validCategoryId,
        status: 'DELETED',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateProductDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown fields (forbidNonWhitelisted)', async () => {
      const raw = {
        sku: 'SKU-200',
        name: 'Hammer',
        categoryId: validCategoryId,
        unknownField: 'malicious',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateProductDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject protected fields like organizationId or id', async () => {
      const rawWithOrg = {
        sku: 'SKU-200',
        name: 'Hammer',
        categoryId: validCategoryId,
        organizationId: 'malicious-org-id',
      };

      await expect(
        validationPipe.transform(rawWithOrg, {
          type: 'body',
          metatype: CreateProductDto,
        }),
      ).rejects.toThrow(BadRequestException);

      const rawWithId = {
        sku: 'SKU-200',
        name: 'Hammer',
        categoryId: validCategoryId,
        id: 'malicious-id',
      };

      await expect(
        validationPipe.transform(rawWithId, {
          type: 'body',
          metatype: CreateProductDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('UpdateProductDto', () => {
    it('should accept partial update fields and trim whitespace', async () => {
      const raw = {
        name: '  Updated Name  ',
        status: 'INACTIVE',
      };

      const result = (await validationPipe.transform(raw, {
        type: 'body',
        metatype: UpdateProductDto,
      })) as UpdateProductDto;

      expect(result.name).toBe('Updated Name');
      expect(result.status).toBe('INACTIVE');
      expect(result.sku).toBeUndefined();
    });

    it('should reject empty name when provided', async () => {
      const raw = { name: '' };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: UpdateProductDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-whitelisted fields', async () => {
      const raw = {
        name: 'Valid Name',
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: UpdateProductDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('QueryProductDto', () => {
    it('should validate and parse query parameters', async () => {
      const raw = {
        page: '2',
        limit: '25',
        search: '  mouse  ',
        categoryId: validCategoryId,
        status: 'ACTIVE',
        unitOfMeasure: 'UNIT',
        sortBy: 'sku',
        sortOrder: 'asc',
      };

      const result = (await validationPipe.transform(raw, {
        type: 'query',
        metatype: QueryProductDto,
      })) as QueryProductDto;

      expect(result.page).toBe(2);
      expect(result.limit).toBe(25);
      expect(result.search).toBe('mouse');
      expect(result.categoryId).toBe(validCategoryId);
      expect(result.status).toBe('ACTIVE');
      expect(result.unitOfMeasure).toBe('UNIT');
      expect(result.getSafeSortBy()).toBe('sku');
      expect(result.sortOrder).toBe('asc');
    });

    it('should safely fallback to default createdAt when invalid sortBy is supplied', async () => {
      const raw = {
        sortBy: 'non_existent_column; DROP TABLE products;',
      };

      const result = (await validationPipe.transform(raw, {
        type: 'query',
        metatype: QueryProductDto,
      })) as QueryProductDto;

      expect(result.getSafeSortBy()).toBe('createdAt');
    });
  });
});
