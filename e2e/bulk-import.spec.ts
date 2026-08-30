import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Bulk Import Flow', () => {
  test('import CSV, validate rows, and import successfully', async ({ page }) => {
    test.setTimeout(45000);

    // 1. Log in
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'test_password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/products/);

    // 2. Go to Bulk Import page
    await page.getByRole('link', { name: 'Import' }).click();
    await expect(page).toHaveURL(/.*\/products\/import/);

    // 3. Create a test CSV
    const csvContent = `sku,barcode,name,description,categoryId,unit,costPrice,salePrice,reorderPoint,reorderQty,trackBatches,isActive
VALID-001,1111,Valid One,Desc,,pcs,10,20,5,10,false,true
VALID-002,2222,Valid Two,Desc,,pcs,15,25,5,10,false,true
INVALID-001,3333,Invalid Product,Desc,,pcs,-5,30,5,10,false,true`;

    const csvPath = path.join(__dirname, 'test-import.csv');
    fs.writeFileSync(csvPath, csvContent);

    // 4. Upload CSV
    await page.locator('input[type="file"]').setInputFiles(csvPath);

    // 5. Verify the preview table
    await expect(page.getByText('Preview')).toBeVisible();
    await expect(page.getByText('Total Rows: 3')).toBeVisible();
    await expect(page.getByText('Valid: 2')).toBeVisible();
    await expect(page.getByText('Invalid: 1')).toBeVisible();

    // The invalid row should show an error for costPrice
    await expect(page.getByText('costPrice: Cost price cannot be negative')).toBeVisible();

    // 6. Import Valid Rows
    // Handle the alert
    page.on('dialog', dialog => dialog.accept());
    
    await page.click('button:has-text("Import 2 Valid Rows")');

    // 7. Verify Redirect and Products Created
    await expect(page).toHaveURL(/.*\/products/);
    await expect(page.getByText('VALID-001', { exact: true })).toBeVisible();
    await expect(page.getByText('VALID-002', { exact: true })).toBeVisible();

    // Clean up
    if (fs.existsSync(csvPath)) {
      fs.unlinkSync(csvPath);
    }
  });
});
