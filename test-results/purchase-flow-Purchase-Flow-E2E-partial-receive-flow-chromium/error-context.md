# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: purchase-flow.spec.ts >> Purchase Flow E2E >> partial receive flow
- Location: e2e/purchase-flow.spec.ts:93:7

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: locator.click: Test timeout of 120000ms exceeded.
Call log:
  - waiting for locator('[role="option"]').first()
    - locator resolved to <div role="option" tabindex="-1" data-selected="" aria-selected="true" data-slot="select-item" class="relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last…>…</div>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    193 × waiting for element to be visible, enabled and stable
        - element is not visible
      - retrying click action
        - waiting 500ms
    - waiting for element to be visible, enabled and stable

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - generic [ref=f1e2]:
    - complementary [ref=f1e3]:
      - generic [ref=f1e10]:
        - heading "Inventory" [level=1] [ref=f1e11]
        - paragraph [ref=f1e12]: Manager
      - navigation [ref=f1e13]:
        - link "Products" [ref=f1e14] [cursor=pointer]:
          - /url: /products
        - link "Warehouses" [ref=f1e19] [cursor=pointer]:
          - /url: /warehouses
        - link "Stock" [ref=f1e23] [cursor=pointer]:
          - /url: /stock
        - link "Purchasing" [ref=f1e34] [cursor=pointer]:
          - /url: /purchasing
        - link "Suggested POs" [ref=f1e40] [cursor=pointer]:
          - /url: /purchasing/suggestions
        - link "PO Approvals" [ref=f1e43] [cursor=pointer]:
          - /url: /purchasing/approvals
        - link "Suppliers" [ref=f1e47] [cursor=pointer]:
          - /url: /suppliers
        - link "Sales" [ref=f1e53] [cursor=pointer]:
          - /url: /sales
        - link "POS" [ref=f1e57] [cursor=pointer]:
          - /url: /pos
        - link "Reports" [ref=f1e62] [cursor=pointer]:
          - /url: /reports
        - link "Users" [ref=f1e66] [cursor=pointer]:
          - /url: /users
        - link "Settings" [ref=f1e72] [cursor=pointer]:
          - /url: /settings
      - generic [ref=f1e76]:
        - generic [ref=f1e77]:
          - generic [ref=f1e78]: E
          - generic [ref=f1e79]:
            - paragraph [ref=f1e80]: E2E Admin
            - paragraph [ref=f1e81]: admin
        - button "Sign out" [ref=f1e82] [cursor=pointer]
    - main [ref=f1e86]:
      - generic [ref=f1e87]:
        - generic [ref=f1e88]:
          - link [ref=f1e89] [cursor=pointer]:
            - /url: /purchasing
            - button [ref=f1e90]
          - generic [ref=f1e91]:
            - heading "Create Purchase Order" [level=1] [ref=f1e92]
            - paragraph [ref=f1e93]: Draft a new PO to send to a supplier
        - generic [ref=f1e94]:
          - generic [ref=f1e95]:
            - generic [ref=f1e96]:
              - generic [ref=f1e97]: Supplier
              - combobox [ref=f1e98] [cursor=pointer]:
                - generic [ref=f1e99]: cmthjluto0001906peyxn99jn
                - img: ▼
              - textbox [ref=f1e100]: cmthjluto0001906peyxn99jn
            - generic [ref=f1e101]:
              - generic [ref=f1e102]: Deliver To (Warehouse)
              - combobox [expanded] [ref=f1e103] [cursor=pointer]:
                - generic [ref=f1e104]: Select warehouse...
                - img: ▼
              - listbox [ref=f1e108]:
                - option "E2E Warehouse" [active] [ref=f1e109]
                - option "Main WH" [ref=f1e111]
              - textbox [ref=f1e115]
            - generic [ref=f1e116]:
              - generic [ref=f1e117]: Expected Date
              - textbox [ref=f1e118]
          - generic [ref=f1e119]:
            - generic [ref=f1e120]:
              - heading "Order Items" [level=2] [ref=f1e121]
              - button "Add Item" [ref=f1e122] [cursor=pointer]
            - generic [ref=f1e123]:
              - generic [ref=f1e124]:
                - generic [ref=f1e125]: Product
                - generic [ref=f1e126]: Quantity
                - generic [ref=f1e127]: Unit Cost
                - generic [ref=f1e128]: Action
              - generic [ref=f1e129]:
                - generic [ref=f1e130]:
                  - combobox [ref=f1e131] [cursor=pointer]:
                    - generic [ref=f1e132]: Select product...
                    - img: ▼
                  - textbox [ref=f1e133]
                - spinbutton [ref=f1e135]: "1"
                - generic [ref=f1e136]:
                  - generic [ref=f1e137]: $
                  - spinbutton [ref=f1e138]
                - generic [ref=f1e139]:
                  - button [disabled]
            - generic [ref=f1e140]: "Total: $0.00"
          - generic [ref=f1e142]:
            - link [ref=f1e143] [cursor=pointer]:
              - /url: /purchasing
              - button "Cancel" [ref=f1e144]
            - button "Create Purchase Order" [ref=f1e145] [cursor=pointer]
  - alert [ref=f1e146]
```

# Test source

```ts
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
  76  |     await expect(page.locator('text=PENDING_APPROVAL').first()).toBeVisible();
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
> 108 |     
      |                                                   ^ Error: locator.click: Test timeout of 120000ms exceeded.
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