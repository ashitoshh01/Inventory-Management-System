import { Prisma } from '@repo/database';

export const CANONICAL_PERMISSIONS = [
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
] as const;

/**
 * Ensures that the canonical Owner role exists and has all 34 core permissions mapped.
 * Executes within the provided transaction client for transactional safety.
 * Fully idempotent: safe to call repeatedly without creating duplicate rows.
 */
export async function ensureOwnerRoleWithPermissions(tx: Prisma.TransactionClient) {
  // 1. Ensure Owner role exists
  let ownerRole = await tx.role.findFirst({ where: { name: 'Owner' } });
  if (!ownerRole) {
    ownerRole = await tx.role.create({
      data: { name: 'Owner', description: 'Organization Owner' },
    });
  }

  // 2. Ensure canonical permissions exist in the database
  const existingPerms = await tx.permission.findMany({
    where: { action: { in: CANONICAL_PERMISSIONS.map((p) => p.action) } },
  });
  const existingActions = new Set(existingPerms.map((p) => p.action));
  const missingPerms = CANONICAL_PERMISSIONS.filter((p) => !existingActions.has(p.action));
  if (missingPerms.length > 0) {
    await tx.permission.createMany({
      data: missingPerms.map((p) => ({ action: p.action, description: p.description })),
      skipDuplicates: true,
    });
  }

  // 3. Fetch all canonical permissions
  const allPerms = await tx.permission.findMany({
    where: { action: { in: CANONICAL_PERMISSIONS.map((p) => p.action) } },
    select: { id: true },
  });

  // 4. Map any missing permissions to the Owner role
  const existingMappings = await tx.rolePermission.findMany({
    where: { roleId: ownerRole.id },
    select: { permissionId: true },
  });
  const mappedIds = new Set(existingMappings.map((m) => m.permissionId));
  const unmapped = allPerms.filter((p) => !mappedIds.has(p.id));

  if (unmapped.length > 0) {
    await tx.rolePermission.createMany({
      data: unmapped.map((p) => ({
        roleId: ownerRole.id,
        permissionId: p.id,
      })),
      skipDuplicates: true,
    });
  }

  return ownerRole;
}
