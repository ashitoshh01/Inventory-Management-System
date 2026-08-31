import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

test.describe('Purchase Flow E2E', () => {
  test.beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('password', 10);
    
    await prisma.user.upsert({
      where: { email: 'e2eadmin@test.com' },
      update: { passwordHash: hashedPassword, role: 'ADMIN' },
      create: { name: 'E2E Admin', email: 'e2eadmin@test.com', passwordHash: hashedPassword, role: 'ADMIN' }
    });

    // Make sure we have a supplier, warehouse, and product
    const supplierCount = await prisma.supplier.count({ where: { name: 'E2E Supplier' } });
    if (supplierCount === 0) {
      await prisma.supplier.create({ data: { name: 'E2E Supplier', email: 'e2esupplier@test.com' } });
    }

    await prisma.warehouse.upsert({
      where: { code: 'E2EWH' },
      update: {},
      create: { name: 'E2E Warehouse', code: 'E2EWH' }
    });

    await prisma.product.upsert({
      where: { sku: 'E2ESKU' },
      update: {},
      create: { name: 'E2E Prod', sku: 'E2ESKU', costPrice: 10, salePrice: 20, unit: 'pcs' }
    });
  });

  test('full purchase flow end to end', async ({ page }) => {
    
    // Login
    await page.goto('/login');
    await page.fill('input[name="email"]', 'e2eadmin@test.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/products');
    
    // 3. Create PO
    await page.goto('/purchasing/new');
    
    // Select Supplier
    await page.locator('button[role="combobox"]').nth(0).click();
    await page.locator('[role="option"]', { hasText: 'E2E Supplier' }).click();
    
    // Select Warehouse
    await page.locator('button[role="combobox"]').nth(1).click();
    await page.locator('[role="option"]', { hasText: 'E2E Warehouse' }).click();
    
    // Select Product
    await page.locator('button[role="combobox"]').nth(2).click();
    await page.locator('[role="option"]', { hasText: 'E2E Prod' }).click();
    
    await page.fill('input[type="number"]', '10'); // orderedQty
    
    await page.click('button:has-text("Create Purchase Order")');
    await page.waitForURL('/purchasing');
    
    // It should be DRAFT
    await expect(page.locator('text=DRAFT').first()).toBeVisible();
    
    // Submit for Approval
    page.once('dialog', dialog => dialog.accept());
    await Promise.all([
      page.waitForResponse(res => res.url().includes('/submit')),
      page.click('button:has-text("Submit")')
    ]);
    
    // Status should change to PENDING_APPROVAL
    await expect(page.locator('text=PENDING_APPROVAL').first()).toBeVisible();
    
    // 4. Go to Approvals and Approve
    await page.goto('/purchasing/approvals');
    await page.click('button:has-text("Approve")');
    
    // 5. Go to Receiving and Receive fully
    await page.goto('/purchasing');
    await expect(page.locator('text=APPROVED').first()).toBeVisible();
    await page.click('text=Receive');
    
    // "Receive Now" defaults to 10. Just submit.
    await page.click('button:has-text("Process Receipt")');
    await page.waitForURL('/purchasing');
    
    // Status should be RECEIVED
    await expect(page.locator('text=RECEIVED').first()).toBeVisible();
  });

  test('partial receive flow', async ({ page }) => {
    // Login with same admin
    await page.goto('/login');
    await page.fill('input[name="email"]', 'e2eadmin@test.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/products');
    
    // Create PO
    await page.goto('/purchasing/new');
    
    await page.locator('button[role="combobox"]').nth(0).click();
    await page.locator('[role="option"]').first().click(); // click first supplier
    
    await page.locator('button[role="combobox"]').nth(1).click();
    await page.locator('[role="option"]').first().click(); // click first warehouse
    
    await page.locator('button[role="combobox"]').nth(2).click();
    await page.locator('[role="option"]').first().click(); // click first product
    
    await page.fill('input[type="number"]', '20'); // orderedQty
    
    await page.click('button:has-text("Create Purchase Order")');
    await page.waitForURL('/purchasing');
    
    page.once('dialog', dialog => dialog.accept());
    await Promise.all([
      page.waitForResponse(res => res.url().includes('/submit')),
      page.click('button:has-text("Submit")')
    ]);
    
    await page.goto('/purchasing/approvals');
    await page.click('button:has-text("Approve")');
    
    await page.goto('/purchasing');
    await page.click('text=Receive');
    
    // Change receive qty to 10
    await page.fill('input[type="number"]', '10');
    await page.click('button:has-text("Process Receipt")');
    await page.waitForURL('/purchasing');
    
    await expect(page.locator('text=PARTIALLY_RECEIVED').first()).toBeVisible();
  });
});
