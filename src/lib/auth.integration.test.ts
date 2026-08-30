import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import prisma from '@/lib/db'
import bcrypt from 'bcrypt'

describe('Auth Integration', () => {
  beforeAll(async () => {
    // Clean up test DB
    await prisma.user.deleteMany()
    await prisma.warehouse.deleteMany()

    // Seed test DB
    const warehouse = await prisma.warehouse.create({
      data: {
        name: 'Test Warehouse',
        code: 'TEST',
      },
    })

    const hashedPassword = await bcrypt.hash('test_password', 10)

    await prisma.user.create({
      data: {
        name: 'Admin Test',
        email: 'admin@test.com',
        passwordHash: hashedPassword,
        role: 'ADMIN',
        warehouseId: warehouse.id,
      },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('verifies correct password using bcrypt', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@test.com' },
    })
    
    expect(user).not.toBeNull()
    
    const isCorrect = await bcrypt.compare('test_password', user!.passwordHash)
    expect(isCorrect).toBe(true)
  })

  it('rejects incorrect password using bcrypt', async () => {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@test.com' },
    })
    
    expect(user).not.toBeNull()
    
    const isCorrect = await bcrypt.compare('wrong_password', user!.passwordHash)
    expect(isCorrect).toBe(false)
  })
})
