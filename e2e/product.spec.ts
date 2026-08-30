import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import prisma from '../src/lib/db';

test.describe('Product Flow', () => {
  test('create category, create product with image, edit, and delete', async ({ page, request }) => {
    test.setTimeout(60000); // 60s timeout for full flow

    // 1. Log in
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'test_password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/products/);

    // 2. Create Category via Prisma
    const categoryName = `E2E Category ${Date.now()}`;
    await prisma.category.create({
      data: { name: categoryName }
    });

    // 3. Create Product
    await page.getByRole('link', { name: 'Add Product' }).click();
    await expect(page).toHaveURL(/.*\/products\/new/);

    const sku = `E2E-SKU-${Date.now()}`;
    await page.fill('#sku', sku);
    await page.fill('#name', 'E2E Test Product');
    await page.fill('#costPrice', '10.50'); // costPrice
    
    // Select category (wait for dropdown to load)
    await page.click('button[role="combobox"]');
    await page.click(`text=${categoryName}`);

    // Upload an image
    // We create a dummy image file for upload
    const dummyImagePath = path.join(__dirname, 'dummy-product.png');
    if (!fs.existsSync(dummyImagePath)) {
      // Just write a 1x1 png or simple txt pretending to be png
      fs.writeFileSync(dummyImagePath, 'dummy content');
    }
    
    // Set file to input
    await page.locator('input[type="file"]').setInputFiles(dummyImagePath);
    // Wait for the upload to complete (simulate by waiting for an img to appear or similar)
    await page.waitForSelector('img[alt="Product"]', { timeout: 15000 });

    // Save product
    await page.click('button:has-text("Save Product")');
    await expect(page).toHaveURL(/.*\/products/);
    await expect(page.locator(`text=${sku}`)).toBeVisible();

    // 4. Edit Product
    const row = page.locator('tr', { hasText: sku });
    await row.locator('a[href^="/products/"]').first().click();
    await expect(page).toHaveURL(new RegExp('.*\\/products\\/[^\\/]+'));
    
    await page.fill('#name', 'E2E Test Product Updated');
    await page.click('button:has-text("Save Product")');
    await expect(page).toHaveURL(/.*\/products/);
    
    // Verify changes persist
    await expect(page.locator('text=E2E Test Product Updated')).toBeVisible();

    // 5. Delete Product
    // Wait for the list to be fully interactive
    const deleteRow = page.locator('tr', { hasText: sku });
    // Handle JS confirm dialog automatically
    page.on('dialog', dialog => dialog.accept());
    
    // Click delete icon inside the row
    await deleteRow.locator('.text-red-500').click();
    
    // Verify it's gone
    await expect(page.locator(`text=${sku}`)).not.toBeVisible();
    
    // Cleanup image
    if (fs.existsSync(dummyImagePath)) {
      fs.unlinkSync(dummyImagePath);
    }
  });
});
