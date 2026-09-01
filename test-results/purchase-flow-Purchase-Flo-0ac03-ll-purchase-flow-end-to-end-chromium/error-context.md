# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: purchase-flow.spec.ts >> Purchase Flow E2E >> full purchase flow end to end
- Location: e2e/purchase-flow.spec.ts:36:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=PENDING_APPROVAL').first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('text=PENDING_APPROVAL').first()

```

```yaml
- complementary:
  - heading "Inventory" [level=1]
  - paragraph: Manager
  - navigation:
    - link "Products":
      - /url: /products
    - link "Warehouses":
      - /url: /warehouses
    - link "Stock":
      - /url: /stock
    - link "Purchasing":
      - /url: /purchasing
    - link "Suggested POs":
      - /url: /purchasing/suggestions
    - link "PO Approvals":
      - /url: /purchasing/approvals
    - link "Suppliers":
      - /url: /suppliers
    - link "Sales":
      - /url: /sales
    - link "POS":
      - /url: /pos
    - link "Reports":
      - /url: /reports
    - link "Users":
      - /url: /users
    - link "Settings":
      - /url: /settings
  - text: E
  - paragraph: E2E Admin
  - paragraph: admin
  - button "Sign out"
- main:
  - heading "Purchasing" [level=1]
  - paragraph: Manage purchase orders and supplier deliveries
  - link "Create PO":
    - /url: /purchasing/new
    - button "Create PO"
  - table:
    - rowgroup:
      - row "PO Number Supplier Warehouse Expected Date Items Status Actions":
        - columnheader "PO Number"
        - columnheader "Supplier"
        - columnheader "Warehouse"
        - columnheader "Expected Date"
        - columnheader "Items"
        - columnheader "Status"
        - columnheader "Actions"
    - rowgroup:
      - row "PO-695008-150 E2E Supplier E2E Warehouse - 1 items PENDING APPROVAL":
        - cell "PO-695008-150"
        - cell "E2E Supplier"
        - cell "E2E Warehouse"
        - cell "-"
        - cell "1 items"
        - cell "PENDING APPROVAL"
        - cell
      - row "PO-582822-663 E2E Supplier E2E Warehouse - 1 items PENDING APPROVAL":
        - cell "PO-582822-663"
        - cell "E2E Supplier"
        - cell "E2E Warehouse"
        - cell "-"
        - cell "1 items"
        - cell "PENDING APPROVAL"
        - cell
      - row "PO-910161-263 Test Supplier Main WH - 1 items PARTIALLY RECEIVED Receive Return":
        - cell "PO-910161-263"
        - cell "Test Supplier"
        - cell "Main WH"
        - cell "-"
        - cell "1 items"
        - cell "PARTIALLY RECEIVED"
        - cell "Receive Return":
          - link "Receive":
            - /url: /purchasing/cmthjgloz001ex44djsxocj5b/receive
            - button "Receive"
          - link "Return":
            - /url: /purchasing/cmthjgloz001ex44djsxocj5b/return
            - button "Return"
- alert
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { PrismaClient } from '@prisma/client';
  3   | import bcrypt from 'bcrypt';
  4   | 
  5   | const prisma = new PrismaClient();
  6   | 
  7   | test.describe('Purchase Flow E2E', () => {
  8   |   test.beforeAll(async () => {
  9   |     const hashedPassword = await bcrypt.hash('password', 10);
  10  |     
  11  |     await prisma.user.upsert({
  12  |       where: { email: 'e2eadmin@test.com' },
  13  |       update: { passwordHash: hashedPassword, role: 'ADMIN' },
  14  |       create: { name: 'E2E Admin', email: 'e2eadmin@test.com', passwordHash: hashedPassword, role: 'ADMIN' }
  15  |     });
  16  | 
  17  |     // Make sure we have a supplier, warehouse, and product
  18  |     const supplierCount = await prisma.supplier.count({ where: { name: 'E2E Supplier' } });
  19  |     if (supplierCount === 0) {
  20  |       await prisma.supplier.create({ data: { name: 'E2E Supplier', email: 'e2esupplier@test.com' } });
  21  |     }
  22  | 
  23  |     await prisma.warehouse.upsert({
  24  |       where: { code: 'E2EWH' },
  25  |       update: {},
  26  |       create: { name: 'E2E Warehouse', code: 'E2EWH' }
  27  |     });
  28  | 
  29  |     await prisma.product.upsert({
  30  |       where: { sku: 'E2ESKU' },
  31  |       update: {},
  32  |       create: { name: 'E2E Prod', sku: 'E2ESKU', costPrice: 10, salePrice: 20, unit: 'pcs' }
  33  |     });
  34  |   });
  35  | 
  36  |   test('full purchase flow end to end', async ({ page }) => {
  37  |     
  38  |     // Login
  39  |     await page.goto('/login');
  40  |     await page.fill('input[name="email"]', 'e2eadmin@test.com');
  41  |     await page.fill('input[name="password"]', 'password');
  42  |     await page.click('button[type="submit"]');
  43  |     await page.waitForURL('**/products');
  44  |     
  45  |     // 3. Create PO
  46  |     await page.goto('/purchasing/new');
  47  |     
  48  |     // Select Supplier
  49  |     await page.locator('button[role="combobox"]').nth(0).click();
  50  |     await page.locator('[role="option"]', { hasText: 'E2E Supplier' }).click();
  51  |     
  52  |     // Select Warehouse
  53  |     await page.locator('button[role="combobox"]').nth(1).click();
  54  |     await page.locator('[role="option"]', { hasText: 'E2E Warehouse' }).click();
  55  |     
  56  |     // Select Product
  57  |     await page.locator('button[role="combobox"]').nth(2).click();
  58  |     await page.locator('[role="option"]', { hasText: 'E2E Prod' }).click();
  59  |     
  60  |     await page.fill('input[type="number"]', '10'); // orderedQty
  61  |     
  62  |     await page.click('button:has-text("Create Purchase Order")');
  63  |     await page.waitForURL('/purchasing');
  64  |     
  65  |     // It should be DRAFT
  66  |     await expect(page.locator('text=DRAFT').first()).toBeVisible();
  67  |     
  68  |     // Submit for Approval
  69  |     page.once('dialog', dialog => dialog.accept());
  70  |     await Promise.all([
  71  |       page.waitForResponse(res => res.url().includes('/submit')),
  72  |       page.click('button:has-text("Submit")')
  73  |     ]);
  74  |     
  75  |     // Status should change to PENDING_APPROVAL
> 76  |     await expect(page.locator('text=PENDING_APPROVAL').first()).toBeVisible();
      |                                                                 ^ Error: expect(locator).toBeVisible() failed
  77  |     
  78  |     // 4. Go to Approvals and Approve
  79  |     await page.goto('/purchasing/approvals');
  80  |     await page.click('button:has-text("Approve")');
  81  |     
  82  |     // 5. Go to Receiving and Receive fully
  83  |     await page.goto('/purchasing');
  84  |     await expect(page.locator('text=APPROVED').first()).toBeVisible();
  85  |     await page.click('text=Receive');
  86  |     
  87  |     // "Receive Now" defaults to 10. Just submit.
  88  |     await page.click('button:has-text("Process Receipt")');
  89  |     await page.waitForURL('/purchasing');
  90  |     
  91  |     // Status should be RECEIVED
  92  |     await expect(page.locator('text=RECEIVED').first()).toBeVisible();
  93  |   });
  94  | 
  95  |   test('partial receive flow', async ({ page }) => {
  96  |     // Login with same admin
  97  |     await page.goto('/login');
  98  |     await page.fill('input[name="email"]', 'e2eadmin@test.com');
  99  |     await page.fill('input[name="password"]', 'password');
  100 |     await page.click('button[type="submit"]');
  101 |     await page.waitForURL('**/products');
  102 |     
  103 |     // Create PO
  104 |     await page.goto('/purchasing/new');
  105 |     
  106 |     await page.locator('button[role="combobox"]').nth(0).click();
  107 |     await page.locator('[role="option"]').first().click(); // click first supplier
  108 |     
  109 |     await page.locator('button[role="combobox"]').nth(1).click();
  110 |     await page.locator('[role="option"]').first().click(); // click first warehouse
  111 |     
  112 |     await page.locator('button[role="combobox"]').nth(2).click();
  113 |     await page.locator('[role="option"]').first().click(); // click first product
  114 |     
  115 |     await page.fill('input[type="number"]', '20'); // orderedQty
  116 |     
  117 |     await page.click('button:has-text("Create Purchase Order")');
  118 |     await page.waitForURL('/purchasing');
  119 |     
  120 |     page.once('dialog', dialog => dialog.accept());
  121 |     await Promise.all([
  122 |       page.waitForResponse(res => res.url().includes('/submit')),
  123 |       page.click('button:has-text("Submit")')
  124 |     ]);
  125 |     
  126 |     await page.goto('/purchasing/approvals');
  127 |     await page.click('button:has-text("Approve")');
  128 |     
  129 |     await page.goto('/purchasing');
  130 |     await page.click('text=Receive');
  131 |     
  132 |     // Change receive qty to 10
  133 |     await page.fill('input[type="number"]', '10');
  134 |     await page.click('button:has-text("Process Receipt")');
  135 |     await page.waitForURL('/purchasing');
  136 |     
  137 |     await expect(page.locator('text=PARTIALLY_RECEIVED').first()).toBeVisible();
  138 |   });
  139 | });
  140 | 
```