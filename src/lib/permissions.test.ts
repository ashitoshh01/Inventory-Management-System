import { describe, it, expect } from 'vitest'
import { can } from './permissions'
import type { Session } from 'next-auth'

describe('Permissions: can()', () => {
  it('ADMIN can access everything', () => {
    const session = { user: { role: 'ADMIN', id: '1', warehouseId: null } } as Session
    expect(can(session, 'read', 'products')).toBe(true)
    expect(can(session, 'create', 'products')).toBe(true)
    expect(can(session, 'delete', 'users')).toBe(true)
    expect(can(session, 'arbitrary_action', 'arbitrary_resource')).toBe(true)
  })

  it('VIEWER cannot create/update/delete anything', () => {
    const session = { user: { role: 'VIEWER', id: '1', warehouseId: null } } as Session
    expect(can(session, 'read', 'products')).toBe(true)
    expect(can(session, 'create', 'products')).toBe(false)
    expect(can(session, 'update', 'warehouses')).toBe(false)
    expect(can(session, 'delete', 'stock')).toBe(false)
  })

  it('WAREHOUSE_STAFF is restricted to their own warehouseId', () => {
    const session = { user: { role: 'WAREHOUSE_STAFF', id: '1', warehouseId: 'W1' } } as Session
    
    // They can read products (no warehouse target specified)
    expect(can(session, 'read', 'products')).toBe(true)
    
    // They can update stock in their own warehouse
    expect(can(session, 'update', 'stock', 'W1')).toBe(true)
    
    // They CANNOT update stock in a different warehouse
    expect(can(session, 'update', 'stock', 'W2')).toBe(false)
  })
})
