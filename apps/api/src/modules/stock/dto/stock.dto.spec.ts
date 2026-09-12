import 'reflect-metadata';
import { ValidationPipe, BadRequestException, ArgumentMetadata } from '@nestjs/common';
import {
  CreateStockMutationDto,
  QueryStockBalanceDto,
  QueryStockLedgerDto,
  ALLOWED_STOCK_BALANCE_SORT_FIELDS,
  ALLOWED_STOCK_LEDGER_SORT_FIELDS,
} from './stock.dto';

describe('Stock DTO Validation (Unit)', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const validProductId = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
  const validWarehouseId = 'b2c3d4e5-f6a7-4b6c-9d0e-1f2a3b4c5d6e';

  async function expectValidationError(
    raw: unknown,
    type: 'body' | 'query',
    metatype: ArgumentMetadata['metatype'],
    expectedPattern?: RegExp,
  ) {
    try {
      await validationPipe.transform(raw, {
        type,
        metatype,
      });
      fail('Expected validation to throw BadRequestException');
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(BadRequestException);
      if (expectedPattern && err instanceof BadRequestException) {
        const response = err.getResponse() as { message?: string | string[] };
        const msg = Array.isArray(response.message)
          ? response.message.join('; ')
          : String(response.message || '');
        expect(msg).toMatch(expectedPattern);
      }
    }
  }

  describe('CreateStockMutationDto', () => {
    it('validates and accepts a valid mutation payload', async () => {
      const raw = {
        productId: validProductId,
        warehouseId: validWarehouseId,
        type: 'RECEIPT',
        quantityDelta: '25.5000',
        idempotencyKey: 'IDEMP-KEY-123_abc',
        referenceType: 'PO',
        referenceId: 'PO-9988',
        metadata: { notes: 'Restocking batch' },
      };

      const result = (await validationPipe.transform(raw, {
        type: 'body',
        metatype: CreateStockMutationDto,
      })) as CreateStockMutationDto;

      expect(result.productId).toBe(validProductId);
      expect(result.warehouseId).toBe(validWarehouseId);
      expect(result.type).toBe('RECEIPT');
      expect(result.quantityDelta).toBe('25.5000');
      expect(result.idempotencyKey).toBe('IDEMP-KEY-123_abc');
      expect(result.referenceType).toBe('PO');
      expect(result.referenceId).toBe('PO-9988');
      expect(result.metadata).toEqual({ notes: 'Restocking batch' });
    });

    it('accepts valid payload without optional fields', async () => {
      const raw = {
        productId: validProductId,
        warehouseId: validWarehouseId,
        type: 'ISSUE',
        quantityDelta: '-10.0000',
      };

      const result = (await validationPipe.transform(raw, {
        type: 'body',
        metatype: CreateStockMutationDto,
      })) as CreateStockMutationDto;

      expect(result.productId).toBe(validProductId);
      expect(result.warehouseId).toBe(validWarehouseId);
      expect(result.type).toBe('ISSUE');
      expect(result.quantityDelta).toBe('-10.0000');
      expect(result.idempotencyKey).toBeUndefined();
    });

    it('rejects missing productId', async () => {
      const raw = {
        warehouseId: validWarehouseId,
        type: 'RECEIPT',
        quantityDelta: '10.0000',
      };

      await expectValidationError(raw, 'body', CreateStockMutationDto, /Product ID is required/i);
    });

    it('rejects invalid UUID productId', async () => {
      const raw = {
        productId: 'not-a-uuid',
        warehouseId: validWarehouseId,
        type: 'RECEIPT',
        quantityDelta: '10.0000',
      };

      await expectValidationError(
        raw,
        'body',
        CreateStockMutationDto,
        /Product ID must be a valid UUIDv4/i,
      );
    });

    it('rejects missing warehouseId', async () => {
      const raw = {
        productId: validProductId,
        type: 'RECEIPT',
        quantityDelta: '10.0000',
      };

      await expectValidationError(raw, 'body', CreateStockMutationDto, /Warehouse ID is required/i);
    });

    it('rejects invalid UUID warehouseId', async () => {
      const raw = {
        productId: validProductId,
        warehouseId: 'invalid-uuid',
        type: 'RECEIPT',
        quantityDelta: '10.0000',
      };

      await expectValidationError(
        raw,
        'body',
        CreateStockMutationDto,
        /Warehouse ID must be a valid UUIDv4/i,
      );
    });

    it('rejects missing type', async () => {
      const raw = {
        productId: validProductId,
        warehouseId: validWarehouseId,
        quantityDelta: '10.0000',
      };

      await expectValidationError(raw, 'body', CreateStockMutationDto, /Type is required/i);
    });

    it('rejects invalid mutation type', async () => {
      const raw = {
        productId: validProductId,
        warehouseId: validWarehouseId,
        type: 'INVALID_TYPE',
        quantityDelta: '10.0000',
      };

      await expectValidationError(raw, 'body', CreateStockMutationDto, /Type must be one of/i);
    });

    it('rejects quantityDelta as a number', async () => {
      const raw = {
        productId: validProductId,
        warehouseId: validWarehouseId,
        type: 'RECEIPT',
        quantityDelta: 10.25,
      };

      await expectValidationError(
        raw,
        'body',
        CreateStockMutationDto,
        /quantityDelta must be a string/i,
      );
    });

    it('rejects quantityDelta with 5 decimal places', async () => {
      const raw = {
        productId: validProductId,
        warehouseId: validWarehouseId,
        type: 'RECEIPT',
        quantityDelta: '10.12345',
      };

      await expectValidationError(raw, 'body', CreateStockMutationDto, /at most 4 decimal places/i);
    });

    it('rejects zero quantityDelta', async () => {
      const raw = {
        productId: validProductId,
        warehouseId: validWarehouseId,
        type: 'RECEIPT',
        quantityDelta: '0.0000',
      };

      await expectValidationError(raw, 'body', CreateStockMutationDto, /non-zero/i);
    });

    it('rejects non-numeric quantityDelta', async () => {
      const raw = {
        productId: validProductId,
        warehouseId: validWarehouseId,
        type: 'RECEIPT',
        quantityDelta: 'invalid-num',
      };

      await expectValidationError(
        raw,
        'body',
        CreateStockMutationDto,
        /non-zero exact decimal string/i,
      );
    });

    it('rejects idempotencyKey with invalid characters', async () => {
      const raw = {
        productId: validProductId,
        warehouseId: validWarehouseId,
        type: 'RECEIPT',
        quantityDelta: '10.0000',
        idempotencyKey: 'bad key!@#$',
      };

      await expectValidationError(
        raw,
        'body',
        CreateStockMutationDto,
        /alphanumeric characters, underscores, and hyphens/i,
      );
    });

    it('rejects idempotencyKey exceeding 100 characters', async () => {
      const raw = {
        productId: validProductId,
        warehouseId: validWarehouseId,
        type: 'RECEIPT',
        quantityDelta: '10.0000',
        idempotencyKey: 'a'.repeat(101),
      };

      await expectValidationError(
        raw,
        'body',
        CreateStockMutationDto,
        /cannot exceed 100 characters/i,
      );
    });

    it('rejects mass assignment fields (organizationId, actorId, quantityBefore, etc.)', async () => {
      const raw = {
        productId: validProductId,
        warehouseId: validWarehouseId,
        type: 'RECEIPT',
        quantityDelta: '10.0000',
        organizationId: 'malicious-org-id',
        actorId: 'malicious-user-id',
        quantityBefore: '9999.0000',
        quantityAfter: '9999.0000',
      };

      await expectValidationError(raw, 'body', CreateStockMutationDto, /should not exist/i);
    });
  });

  describe('QueryStockBalanceDto', () => {
    it('accepts valid query parameters', async () => {
      const raw = {
        page: '2',
        limit: '50',
        productId: validProductId,
        warehouseId: validWarehouseId,
        sortBy: 'quantity',
        sortOrder: 'asc',
      };

      const result = (await validationPipe.transform(raw, {
        type: 'query',
        metatype: QueryStockBalanceDto,
      })) as QueryStockBalanceDto;

      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
      expect(result.productId).toBe(validProductId);
      expect(result.warehouseId).toBe(validWarehouseId);
      expect(result.sortBy).toBe('quantity');
      expect(result.sortOrder).toBe('asc');
      expect(result.getSafeSortBy()).toBe('quantity');
    });

    it('rejects invalid sortBy field', async () => {
      const raw = {
        sortBy: 'nonExistentField; DROP TABLE "StockBalance";',
      };

      await expectValidationError(raw, 'query', QueryStockBalanceDto, /Sort field must be one of/i);
    });

    it('accepts each allowed balance sort field', async () => {
      for (const field of ALLOWED_STOCK_BALANCE_SORT_FIELDS) {
        const raw = { sortBy: field };
        const result = (await validationPipe.transform(raw, {
          type: 'query',
          metatype: QueryStockBalanceDto,
        })) as QueryStockBalanceDto;
        expect(result.getSafeSortBy()).toBe(field);
      }
    });
  });

  describe('QueryStockLedgerDto', () => {
    it('accepts valid query parameters with type filter', async () => {
      const raw = {
        page: '1',
        limit: '25',
        type: 'ADJUSTMENT',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const result = (await validationPipe.transform(raw, {
        type: 'query',
        metatype: QueryStockLedgerDto,
      })) as QueryStockLedgerDto;

      expect(result.page).toBe(1);
      expect(result.limit).toBe(25);
      expect(result.type).toBe('ADJUSTMENT');
      expect(result.sortBy).toBe('createdAt');
      expect(result.getSafeSortBy()).toBe('createdAt');
    });

    it('rejects invalid type filter', async () => {
      const raw = {
        type: 'DESTROYED',
      };

      await expectValidationError(raw, 'query', QueryStockLedgerDto, /Type filter must be one of/i);
    });

    it('rejects invalid sort field on ledger query', async () => {
      const raw = {
        sortBy: 'password',
      };

      await expectValidationError(raw, 'query', QueryStockLedgerDto, /Sort field must be one of/i);
    });

    it('accepts each allowed ledger sort field', async () => {
      for (const field of ALLOWED_STOCK_LEDGER_SORT_FIELDS) {
        const raw = { sortBy: field };
        const result = (await validationPipe.transform(raw, {
          type: 'query',
          metatype: QueryStockLedgerDto,
        })) as QueryStockLedgerDto;
        expect(result.getSafeSortBy()).toBe(field);
      }
    });
  });
});
