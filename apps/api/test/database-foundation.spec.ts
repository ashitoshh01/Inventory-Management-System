import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@repo/database';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { HealthService } from '../src/modules/health/health.service';
import { ConfigService } from '@nestjs/config';

describe('Phase 1D Database Foundation Suite', () => {
  jest.setTimeout(15000);

  let app: INestApplication;
  let prismaService: PrismaService;
  let logger: StructuredLogger;

  beforeAll(async () => {
    logger = new StructuredLogger();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({
      bufferLogs: true,
      logger,
    });

    app.setGlobalPrefix('api/v1', {
      exclude: ['health/{*path}', 'api/v1/health/{*path}'],
    });

    app.useGlobalFilters(new AllExceptionsFilter(logger));
    app.useGlobalInterceptors(new LoggingInterceptor(logger), new TransformInterceptor());

    app.enableShutdownHooks();
    await app.init();

    prismaService = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // 1. Prisma Client initialization
  it('1. should initialize PrismaService as an injectable singleton', () => {
    expect(prismaService).toBeDefined();
    expect(prismaService.constructor.name).toBe('PrismaService');
    expect(typeof prismaService.$queryRaw).toBe('function');
    expect(typeof prismaService.$transaction).toBe('function');
  });

  // 2. PostgreSQL Connection
  it('2. should connect to PostgreSQL without throwing', async () => {
    await expect(prismaService.$connect()).resolves.not.toThrow();
  });

  // 3. Simple Query Execution
  it('3. should execute a basic parameterized query (SELECT 1)', async () => {
    const result = await prismaService.$queryRaw<Array<{ num: number }>>`SELECT 1 AS num`;
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(Number(result[0]?.num)).toBe(1);
  });

  // 4. Transaction Capability (Commit & Rollback)
  it('4. should successfully execute interactive Prisma transactions and handle rollbacks', async () => {
    // 4a. Transaction commit
    const txResult = await prismaService.$transaction(async (tx) => {
      const step1 = await tx.$queryRaw<Array<{ a: number }>>`SELECT 10 AS a`;
      const step2 = await tx.$queryRaw<Array<{ b: number }>>`SELECT 20 AS b`;
      return {
        a: Number(step1[0]?.a),
        b: Number(step2[0]?.b),
      };
    });

    expect(txResult).toEqual({ a: 10, b: 20 });

    // 4b. Transaction rollback on forced exception
    await expect(
      prismaService.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1`;
        throw new Error('FORCED_ROLLBACK_TEST');
      }),
    ).rejects.toThrow('FORCED_ROLLBACK_TEST');
  });

  // 5. Clean Disconnection & Reconnection
  it('5. should disconnect cleanly and reconnect without leaking connections', async () => {
    await expect(prismaService.$disconnect()).resolves.not.toThrow();
    // Verify it can reconnect seamlessly
    const result = await prismaService.$queryRaw<Array<{ ping: number }>>`SELECT 99 AS ping`;
    expect(Number(result[0]?.ping)).toBe(99);
  });

  // 6. NestJS Application Integration
  it('6. should boot the NestJS application with DatabaseModule cleanly', () => {
    expect(app.getHttpServer()).toBeDefined();
  });

  // 7. API Readiness Probe with PostgreSQL
  it('7. should return 200 OK and database: "up" via Prisma on GET /health/readiness', async () => {
    const res = await request(app.getHttpServer()).get('/health/readiness').expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBe('up');
    expect(res.body.data.redis).toBe('up');
  });

  // 8. Safe Failure Handling when PostgreSQL is unreachable
  it('8. should safely handle database probe failures in HealthService', async () => {
    const mockPrisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('Connection terminated')),
    } as unknown as PrismaService;

    const healthService = new HealthService(
      mockPrisma,
      app.get<ConfigService>(ConfigService),
      logger,
    );

    await expect(healthService.checkReadiness()).rejects.toThrow();
  });

  // 9. Confidentiality: DATABASE_URL is never exposed in API responses
  it('9. should never leak DATABASE_URL or database credentials in API responses', async () => {
    const dbUrl = process.env.DATABASE_URL || 'localhost:5436';
    const pwd = process.env.POSTGRES_PASSWORD || 'postgres';

    const livenessRes = await request(app.getHttpServer()).get('/health/liveness').expect(200);
    expect(JSON.stringify(livenessRes.body)).not.toContain(dbUrl);
    expect(JSON.stringify(livenessRes.body)).not.toContain(`:${pwd}@`);

    const readinessRes = await request(app.getHttpServer()).get('/health/readiness').expect(200);
    expect(JSON.stringify(readinessRes.body)).not.toContain(dbUrl);
    expect(JSON.stringify(readinessRes.body)).not.toContain(`:${pwd}@`);

    const errorRes = await request(app.getHttpServer()).get('/api/v1/invalid-route').expect(404);
    expect(JSON.stringify(errorRes.body)).not.toContain(dbUrl);
    expect(JSON.stringify(errorRes.body)).not.toContain(`:${pwd}@`);
  });

  // 10. Package Boundary Verification
  it('10. should enforce architectural boundary prohibiting apps/web from importing @repo/database', () => {
    const eslintWebPath = path.resolve(__dirname, '../../../packages/config/eslint.web.mjs');
    expect(fs.existsSync(eslintWebPath)).toBe(true);

    const configContent = fs.readFileSync(eslintWebPath, 'utf-8');
    expect(configContent).toContain('@repo/database');
    expect(configContent).toContain('apps/web must NEVER import from @repo/database');
  });
});
