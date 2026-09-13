import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.info('[Seed] Starting database foundation seed...');

  try {
    // Verify database connectivity and basic query execution
    await prisma.$queryRaw`SELECT 1`;
    console.info('[Seed] Database connectivity verified successfully.');

    // Seed core permissions idempotently
    const corePermissions = [
      { action: 'organization.read', description: 'Read organization details' },
      { action: 'organization.manage', description: 'Manage organization settings' },
      { action: 'member.read', description: 'View organization members' },
      { action: 'member.manage', description: 'Manage organization memberships' },
      { action: 'category.read', description: 'View categories' },
      { action: 'category.create', description: 'Create categories' },
      { action: 'category.update', description: 'Update categories' },
      { action: 'category.delete', description: 'Delete categories' },
      { action: 'product.read', description: 'View products' },
      { action: 'product.create', description: 'Create products' },
      { action: 'product.update', description: 'Update products' },
      { action: 'product.delete', description: 'Delete products' },
      { action: 'warehouse.read', description: 'View warehouses' },
      { action: 'warehouse.create', description: 'Create warehouses' },
      { action: 'warehouse.update', description: 'Update warehouses' },
      { action: 'warehouse.delete', description: 'Delete warehouses' },
      { action: 'stock.read', description: 'View stock balances and ledger history' },
      { action: 'stock.mutate', description: 'Mutate stock balances' },
      { action: 'purchase-order.read', description: 'View purchase orders' },
      { action: 'purchase-order.create', description: 'Create purchase orders' },
      { action: 'purchase-order.update', description: 'Update purchase orders' },
      { action: 'purchase-order.delete', description: 'Delete draft purchase orders' },
      { action: 'purchase-order.submit', description: 'Submit purchase orders for approval' },
      { action: 'purchase-order.approve', description: 'Approve submitted purchase orders' },
      {
        action: 'purchase-order.receive',
        description: 'Receive inventory against approved purchase orders',
      },
      { action: 'purchase-order.cancel', description: 'Cancel purchase orders' },
    ];

    for (const perm of corePermissions) {
      await prisma.permission.upsert({
        where: { action: perm.action },
        update: { description: perm.description },
        create: { action: perm.action, description: perm.description },
      });
    }
    console.info(`[Seed] Seeded ${corePermissions.length} permissions successfully.`);
  } catch (error) {
    console.error('[Seed] Database connectivity check failed during seed.');
    throw error;
  } finally {
    await prisma.$disconnect();
    console.info('[Seed] Disconnected cleanly from database.');
  }
}

main().catch((error) => {
  console.error(
    '[Seed] Fatal error in database seed:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
