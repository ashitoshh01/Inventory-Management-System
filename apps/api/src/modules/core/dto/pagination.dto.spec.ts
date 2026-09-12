import 'reflect-metadata';
import { validate } from 'class-validator';
import {
  PaginationQueryDto,
  buildPaginationMeta,
  createPaginatedResponse,
  validateSortField,
} from './pagination.dto';

describe('PaginationDto & Utilities (Unit)', () => {
  describe('PaginationQueryDto validation', () => {
    it('should pass with valid default and custom values', async () => {
      const dto = new PaginationQueryDto();
      dto.page = 2;
      dto.limit = 50;
      dto.sortBy = 'name';
      dto.sortOrder = 'asc';

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.getSkip()).toBe(50);
      expect(dto.getTake()).toBe(50);
    });

    it('should fail if limit exceeds max allowed (100) or is negative', async () => {
      const dto = new PaginationQueryDto();
      dto.limit = 101;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const invalidPageDto = new PaginationQueryDto();
      invalidPageDto.page = 0;
      const pageErrors = await validate(invalidPageDto);
      expect(pageErrors.length).toBeGreaterThan(0);
    });

    it('should fail if sortOrder is not asc or desc', async () => {
      const dto = new PaginationQueryDto();
      (dto as unknown as { sortOrder: string }).sortOrder = 'invalid';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('buildPaginationMeta()', () => {
    it('should calculate pagination metadata accurately', () => {
      const meta = buildPaginationMeta(95, 2, 20);
      expect(meta).toEqual({
        total: 95,
        page: 2,
        limit: 20,
        totalPages: 5,
        hasNextPage: true,
        hasPreviousPage: true,
      });

      const lastPageMeta = buildPaginationMeta(95, 5, 20);
      expect(lastPageMeta.hasNextPage).toBe(false);
      expect(lastPageMeta.hasPreviousPage).toBe(true);

      const firstPageMeta = buildPaginationMeta(95, 1, 20);
      expect(firstPageMeta.hasPreviousPage).toBe(false);
    });
  });

  describe('createPaginatedResponse()', () => {
    it('should format data into standard paginated envelope', () => {
      const items = [{ id: '1' }, { id: '2' }];
      const res = createPaginatedResponse(items, 2, 1, 10, 'req-xyz');

      expect(res.data).toEqual(items);
      expect(res.meta.total).toBe(2);
      expect(res.meta.requestId).toBe('req-xyz');
    });
  });

  describe('validateSortField()', () => {
    const allowed = ['name', 'createdAt', 'status'];

    it('should allow valid fields from allowlist', () => {
      expect(validateSortField('name', allowed)).toBe('name');
      expect(validateSortField('createdAt', allowed)).toBe('createdAt');
    });

    it('should fallback to defaultField on unallowed fields or SQL injection attempts', () => {
      expect(validateSortField('password_hash', allowed, 'createdAt')).toBe('createdAt');
      expect(validateSortField('name; DROP TABLE users;', allowed, 'createdAt')).toBe('createdAt');
      expect(validateSortField(undefined, allowed, 'createdAt')).toBe('createdAt');
    });
  });
});
