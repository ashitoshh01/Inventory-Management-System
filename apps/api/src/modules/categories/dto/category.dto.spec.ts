import 'reflect-metadata';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { CreateCategoryDto, UpdateCategoryDto, QueryCategoryDto } from './category.dto';

describe('Category DTO Validation (Unit)', () => {
  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  describe('CreateCategoryDto', () => {
    it('should validate and transform a valid payload with whitespace trimming', async () => {
      const raw = {
        name: '  Electronics & Hardware  ',
        description: '  Various electronic and hardware tools  ',
      };

      const result = (await validationPipe.transform(raw, {
        type: 'body',
        metatype: CreateCategoryDto,
      })) as CreateCategoryDto;

      expect(result.name).toBe('Electronics & Hardware');
      expect(result.description).toBe('Various electronic and hardware tools');
    });

    it('should pass with only required name and no description', async () => {
      const raw = { name: 'Raw Materials' };

      const result = (await validationPipe.transform(raw, {
        type: 'body',
        metatype: CreateCategoryDto,
      })) as CreateCategoryDto;

      expect(result.name).toBe('Raw Materials');
      expect(result.description).toBeUndefined();
    });

    it('should reject missing name', async () => {
      const raw = { description: 'Missing name' };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateCategoryDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty name', async () => {
      const raw = { name: '' };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateCategoryDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject whitespace-only name after trimming', async () => {
      const raw = { name: '     ' };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateCategoryDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject name exceeding 100 characters', async () => {
      const raw = { name: 'A'.repeat(101) };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateCategoryDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject description exceeding 500 characters', async () => {
      const raw = { name: 'Valid Name', description: 'D'.repeat(501) };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateCategoryDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown fields (forbidNonWhitelisted)', async () => {
      const raw = {
        name: 'Valid Name',
        extraField: 'malicious',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateCategoryDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject attempts to inject organizationId or id or createdAt', async () => {
      const raw = {
        name: 'Valid Name',
        organizationId: '00000000-0000-0000-0000-000000000001',
      };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: CreateCategoryDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('UpdateCategoryDto', () => {
    it('should pass with partial updates (only name or only description)', async () => {
      const rawNameOnly = { name: 'Updated Name' };
      const resName = (await validationPipe.transform(rawNameOnly, {
        type: 'body',
        metatype: UpdateCategoryDto,
      })) as UpdateCategoryDto;
      expect(resName.name).toBe('Updated Name');

      const rawDescOnly = { description: 'Updated Description' };
      const resDesc = (await validationPipe.transform(rawDescOnly, {
        type: 'body',
        metatype: UpdateCategoryDto,
      })) as UpdateCategoryDto;
      expect(resDesc.description).toBe('Updated Description');
    });

    it('should reject empty or whitespace-only name if provided in update', async () => {
      const raw = { name: '   ' };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: UpdateCategoryDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown field injection in update', async () => {
      const raw = { organizationId: '00000000-0000-0000-0000-000000000001' };

      await expect(
        validationPipe.transform(raw, {
          type: 'body',
          metatype: UpdateCategoryDto,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('QueryCategoryDto', () => {
    it('should provide safe sort fields allowlist', async () => {
      const query = new QueryCategoryDto();
      query.sortBy = 'name';
      expect(query.getSafeSortBy()).toBe('name');

      query.sortBy = 'createdAt';
      expect(query.getSafeSortBy()).toBe('createdAt');

      query.sortBy = 'updatedAt';
      expect(query.getSafeSortBy()).toBe('updatedAt');

      query.sortBy = 'arbitrary_sql_column';
      expect(query.getSafeSortBy()).toBe('createdAt'); // Fallback to default safe sort field
    });
  });
});
