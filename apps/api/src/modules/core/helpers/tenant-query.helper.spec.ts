import { BadRequestException } from '@nestjs/common';
import { TenantQueryHelper } from './tenant-query.helper';
import { EntityNotFoundException } from '../errors/domain.errors';

describe('TenantQueryHelper (Unit)', () => {
  const orgId = 'org-uuid-1234';

  describe('scopeToOrg()', () => {
    it('should inject organizationId into where criteria', () => {
      const criteria = { name: 'Widget', isActive: true };
      const scoped = TenantQueryHelper.scopeToOrg(criteria, orgId);

      expect(scoped).toEqual({
        name: 'Widget',
        isActive: true,
        organizationId: orgId,
      });
    });

    it('should throw BadRequestException if organizationId is missing or empty', () => {
      expect(() => TenantQueryHelper.scopeToOrg({}, '')).toThrow(BadRequestException);
      expect(() => TenantQueryHelper.scopeToOrg({}, '   ')).toThrow(BadRequestException);
    });
  });

  describe('assertTenantOwnership()', () => {
    it('should return resource if it belongs to expected tenant', () => {
      const resource = { id: 'item-1', organizationId: orgId, name: 'Item' };
      const result = TenantQueryHelper.assertTenantOwnership(resource, orgId);
      expect(result).toBe(resource);
    });

    it('should throw EntityNotFoundException (NOT Forbidden) if resource belongs to different organization (IDOR protection)', () => {
      const foreignResource = { id: 'item-1', organizationId: 'foreign-org-999', name: 'Secret' };
      expect(() => TenantQueryHelper.assertTenantOwnership(foreignResource, orgId, 'Item')).toThrow(
        EntityNotFoundException,
      );
    });

    it('should throw EntityNotFoundException if resource is null or undefined', () => {
      expect(() => TenantQueryHelper.assertTenantOwnership(null, orgId)).toThrow(
        EntityNotFoundException,
      );
      expect(() => TenantQueryHelper.assertTenantOwnership(undefined, orgId)).toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe('buildScopedLookup()', () => {
    it('should construct scoped id and organizationId criteria', () => {
      const criteria = TenantQueryHelper.buildScopedLookup('item-42', orgId, { isArchived: false });
      expect(criteria).toEqual({
        id: 'item-42',
        organizationId: orgId,
        isArchived: false,
      });
    });

    it('should throw BadRequestException if id is invalid', () => {
      expect(() => TenantQueryHelper.buildScopedLookup('', orgId)).toThrow(BadRequestException);
    });
  });
});
