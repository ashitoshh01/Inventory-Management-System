import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('login, access dashboard, and logout', async ({ page }) => {
    // Visit login
    await page.goto('/login');
    
    // Fill credentials (the seeded admin from Prisma)
    // The test database is used here, assuming the test script starts the server with the test DB
    // Actually, in the dev environment, it uses the regular .env database.
    // If the "test:e2e" script uses the test database, we will login with the seeded admin.
    // But since `seed.ts` creates the same admin in BOTH dev and test databases, we can use the same credentials.
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'test_password');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Check redirect to products (or any dashboard page)
    await expect(page).toHaveURL(/.*\/products/);
    
    // Confirm sidebar shows nav items
    await expect(page.locator('text=IMS Dashboard')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Products' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Warehouses' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    
    // Logout
    await page.click('button:has-text("Sign Out")');
    
    // Check redirect to login
    await expect(page).toHaveURL(/.*\/login/);
    
    // Confirm visiting dashboard redirects to login
    await page.goto('/products');
    await expect(page).toHaveURL(/.*\/login/);
  });
});
