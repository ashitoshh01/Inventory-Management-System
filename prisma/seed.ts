import { PrismaClient, RoleName } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // Create Main Warehouse
  const warehouse = await prisma.warehouse.upsert({
    where: { code: 'MAIN' },
    update: {},
    create: {
      name: 'Main Warehouse',
      code: 'MAIN',
      address: '123 Main St',
    },
  })
  console.log(`Upserted Warehouse: ${warehouse.name}`)

  // Create ADMIN user
  const adminEmail = 'admin@example.com'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD

  if (!adminPassword) {
    throw new Error('SEED_ADMIN_PASSWORD environment variable is required for seeding.')
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10)

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      passwordHash: hashedPassword,
      role: RoleName.ADMIN,
      warehouseId: warehouse.id,
    },
    create: {
      name: 'System Admin',
      email: adminEmail,
      passwordHash: hashedPassword,
      role: RoleName.ADMIN,
      warehouseId: warehouse.id,
    },
  })
  console.log(`Upserted Admin User: ${adminUser.email}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
