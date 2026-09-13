import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@repo/database';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');

export interface BenchmarkResult {
  endpoint: string;
  totalRequests: number;
  concurrency: number;
  durationSeconds: number;
  throughputRps: number;
  latencies: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  errors: number;
  errorRatePercent: number;
}

function calculatePercentiles(latencies: number[]) {
  if (latencies.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0 };
  latencies.sort((a, b) => a - b);
  const p = (pct: number) =>
    latencies[Math.min(latencies.length - 1, Math.floor((pct / 100) * latencies.length))]!;
  return {
    p50: Math.round(p(50)),
    p90: Math.round(p(90)),
    p95: Math.round(p(95)),
    p99: Math.round(p(99)),
  };
}

async function runConcurrentBenchmark(
  name: string,
  url: string,
  method: 'GET' | 'POST',
  headers: Record<string, string>,
  body: string | null,
  totalRequests: number,
  concurrency: number,
  useUniqueIps = false,
): Promise<BenchmarkResult> {
  const latencies: number[] = [];
  let errorCount = 0;
  let completed = 0;

  const startTime = Date.now();

  const runWorker = async (workerId: number) => {
    while (true) {
      if (completed >= totalRequests) {
        break;
      }
      completed++;

      const reqStart = Date.now();
      try {
        const reqHeaders = { ...headers };
        if (useUniqueIps) {
          reqHeaders['x-forwarded-for'] =
            `192.168.${Math.floor(workerId / 250)}.${(workerId % 250) + 1}`;
        }

        const res = await fetch(url, {
          method,
          headers: reqHeaders,
          body: body || undefined,
        });

        const reqDuration = Date.now() - reqStart;
        latencies.push(reqDuration);

        if (!res.ok) {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }
  };

  const workers = Array.from({ length: concurrency }, (_, idx) => runWorker(idx));
  await Promise.all(workers);

  const totalDuration = (Date.now() - startTime) / 1000;
  const throughput = Math.round((totalRequests / totalDuration) * 10) / 10;
  const percentiles = calculatePercentiles(latencies);

  return {
    endpoint: name,
    totalRequests,
    concurrency,
    durationSeconds: Math.round(totalDuration * 100) / 100,
    throughputRps: throughput,
    latencies: percentiles,
    errors: errorCount,
    errorRatePercent: Math.round((errorCount / totalRequests) * 1000) / 10,
  };
}

describe('Production Load Benchmark (~100 Concurrent Active Requests)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testEmail: string;
  let orgId: string;
  let accessToken: string;
  let authHeaders: Record<string, string>;
  const PORT = 4099;

  beforeAll(async () => {
    process.env.COOKIE_SECURE = 'false';
    const logger = new StructuredLogger();
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger });
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1', {
      exclude: ['health/{*path}', 'api/v1/health/{*path}'],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(logger));
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.listen(PORT);
    prisma = app.get<PrismaService>(PrismaService);

    testEmail = `loadbench-${Date.now()}@example.com`;
    const testPassword = 'Password123!';

    const regRes = await fetch(`http://localhost:${PORT}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        organizationName: 'Load Benchmark Org',
      }),
    });
    const regData = (await regRes.json()) as { data: { organization: { id: string } } };
    orgId = regData.data.organization.id;

    const loginRes = await fetch(`http://localhost:${PORT}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: testPassword }),
    });

    const setCookies = loginRes.headers.get('set-cookie') || '';
    const tokenMatch = setCookies.match(/accessToken=([^;]+)/);
    if (tokenMatch) {
      accessToken = tokenMatch[1]!;
    }

    authHeaders = {
      'Content-Type': 'application/json',
      Cookie: `accessToken=${accessToken}`,
      'x-organization-id': orgId,
    };

    // Seed 10 products and warehouse
    const category = await prisma.category.create({
      data: { organizationId: orgId, name: 'Benchmark Category' },
    });

    const warehouse = await prisma.warehouse.create({
      data: {
        organizationId: orgId,
        name: 'Benchmark Warehouse',
        code: `BMW-${Date.now().toString().slice(-4)}`,
      },
    });

    for (let i = 1; i <= 10; i++) {
      const product = await prisma.product.create({
        data: {
          organizationId: orgId,
          categoryId: category.id,
          name: `Benchmark Product ${i}`,
          sku: `BM-SKU-${i}-${Date.now().toString().slice(-4)}`,
        },
      });

      await prisma.stockBalance.create({
        data: {
          organizationId: orgId,
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: 100,
        },
      });
    }

    // Seed a purchase order
    await prisma.purchaseOrder.create({
      data: {
        organizationId: orgId,
        purchaseOrderNumber: `PO-BM-${Date.now().toString().slice(-4)}`,
        supplierName: 'Benchmark Supplier',
        warehouseId: warehouse.id,
        status: 'DRAFT',
        subtotal: 1000,
        grandTotal: 1000,
      },
    });
  }, 30000);

  afterAll(async () => {
    if (orgId) {
      await prisma.goodsReceiptLine.deleteMany({ where: { organizationId: orgId } });
      await prisma.goodsReceipt.deleteMany({ where: { organizationId: orgId } });
      await prisma.purchaseOrderLine.deleteMany({ where: { organizationId: orgId } });
      await prisma.purchaseOrder.deleteMany({ where: { organizationId: orgId } });
      await prisma.stockLedgerEntry.deleteMany({ where: { organizationId: orgId } });
      await prisma.stockBalance.deleteMany({ where: { organizationId: orgId } });
      await prisma.product.deleteMany({ where: { organizationId: orgId } });
      await prisma.category.deleteMany({ where: { organizationId: orgId } });
      await prisma.warehouse.deleteMany({ where: { organizationId: orgId } });
      await prisma.organizationMembership.deleteMany({ where: { organizationId: orgId } });
      await prisma.auditEvent.deleteMany({ where: { organizationId: orgId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
      await prisma.user.deleteMany({ where: { email: testEmail } });
    }
    await app.close();
  });

  it('runs 100-concurrency benchmark across core endpoints and logs metrics', async () => {
    const results: BenchmarkResult[] = [];

    // 1. POST /auth/login (100 requests, 100 concurrent across distinct client IPs)
    results.push(
      await runConcurrentBenchmark(
        'POST /auth/login',
        `http://localhost:${PORT}/api/v1/auth/login`,
        'POST',
        { 'Content-Type': 'application/json' },
        JSON.stringify({ email: testEmail, password: 'Password123!' }),
        100,
        100,
        true,
      ),
    );

    // 2. GET /products (300 requests, 100 concurrent)
    results.push(
      await runConcurrentBenchmark(
        'GET /products',
        `http://localhost:${PORT}/api/v1/products?limit=20`,
        'GET',
        authHeaders,
        null,
        300,
        100,
      ),
    );

    // 3. GET /stock/balances (300 requests, 100 concurrent)
    results.push(
      await runConcurrentBenchmark(
        'GET /stock/balances',
        `http://localhost:${PORT}/api/v1/stock/balances?limit=20`,
        'GET',
        authHeaders,
        null,
        300,
        100,
      ),
    );

    // 4. GET /warehouses (300 requests, 100 concurrent)
    results.push(
      await runConcurrentBenchmark(
        'GET /warehouses',
        `http://localhost:${PORT}/api/v1/warehouses`,
        'GET',
        authHeaders,
        null,
        300,
        100,
      ),
    );

    // 5. GET /purchase-orders (300 requests, 100 concurrent)
    results.push(
      await runConcurrentBenchmark(
        'GET /purchase-orders',
        `http://localhost:${PORT}/api/v1/purchase-orders`,
        'GET',
        authHeaders,
        null,
        300,
        100,
      ),
    );

    console.info('\n===============================================================');
    console.info('BENCHMARK RESULTS TABLE (100 Concurrent Active Requests)');
    console.info('===============================================================');
    // eslint-disable-next-line no-console
    console.table(
      results.map((r) => ({
        Endpoint: r.endpoint,
        Requests: r.totalRequests,
        Concurrency: r.concurrency,
        'Throughput (req/s)': r.throughputRps,
        'p50 (ms)': r.latencies.p50,
        'p95 (ms)': r.latencies.p95,
        'p99 (ms)': r.latencies.p99,
        'Error Rate': `${r.errorRatePercent}%`,
      })),
    );

    for (const r of results) {
      expect(r.errorRatePercent).toBe(0);
      const minThroughput = r.endpoint === 'POST /auth/login' ? 2 : 10;
      expect(r.throughputRps).toBeGreaterThan(minThroughput);
    }
  }, 60000);
});
