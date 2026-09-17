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
      { action: 'stock-transfer.read', description: 'View stock transfers' },
      { action: 'stock-transfer.create', description: 'Create stock transfers' },
      { action: 'stock-transfer.update', description: 'Update draft stock transfers' },
      { action: 'stock-transfer.delete', description: 'Delete draft stock transfers' },
      { action: 'stock-transfer.approve', description: 'Approve stock transfers' },
      { action: 'stock-transfer.ship', description: 'Dispatch stock transfers' },
      { action: 'stock-transfer.receive', description: 'Receive stock transfers' },
      { action: 'stock-transfer.cancel', description: 'Cancel stock transfers' },
      { action: 'customer.read', description: 'View customers' },
      { action: 'customer.create', description: 'Create customers' },
      { action: 'customer.update', description: 'Update customers' },
      { action: 'customer.delete', description: 'Delete customers' },
      { action: 'sales-order.read', description: 'View sales orders' },
      { action: 'sales-order.create', description: 'Create sales orders' },
      { action: 'sales-order.update', description: 'Update draft sales orders' },
      { action: 'sales-order.delete', description: 'Delete draft sales orders' },
      { action: 'sales-order.submit', description: 'Submit sales orders for approval' },
      { action: 'sales-order.approve', description: 'Approve submitted sales orders' },
      { action: 'sales-order.fulfill', description: 'Fulfill sales orders and deduct inventory' },
      { action: 'sales-order.cancel', description: 'Cancel sales orders' },
      { action: 'report.read', description: 'View business reports and analytics' },
      { action: 'report.export', description: 'Export business reports to CSV' },
      { action: 'notification.read', description: 'View notifications and alerts' },
      { action: 'notification.manage', description: 'Mark notifications as read and manage alert state' },
    ];

    for (const perm of corePermissions) {
      await prisma.permission.upsert({
        where: { action: perm.action },
        update: { description: perm.description },
        create: { action: perm.action, description: perm.description },
      });
    }
    console.info(`[Seed] Seeded ${corePermissions.length} permissions successfully.`);

    // Seed Owner role and map all permissions idempotently
    let ownerRole = await prisma.role.findFirst({ where: { name: 'Owner' } });
    if (!ownerRole) {
      ownerRole = await prisma.role.create({
        data: { name: 'Owner', description: 'Organization Owner' },
      });
    }

    const allPermissions = await prisma.permission.findMany({ select: { id: true } });
    for (const perm of allPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: ownerRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: ownerRole.id,
          permissionId: perm.id,
        },
      });
    }
    console.info(`[Seed] Mapped ${allPermissions.length} permissions to Owner role successfully.`);

    const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'admin@stockministry.com';
    const adminUser = await prisma.user.findUnique({
      where: { email: platformAdminEmail },
    });
    if (adminUser) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { isPlatformAdmin: true },
      });
      console.info(`[Seed] Promoted ${platformAdminEmail} to platform admin.`);
    }
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
