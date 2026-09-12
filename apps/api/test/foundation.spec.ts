import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('Phase 1C Backend Foundation Suite', () => {
  jest.setTimeout(15000);
  let app: INestApplication;
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

    const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
    app.enableCors({
      origin: (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void,
      ) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Idempotency-Key'],
      exposedHeaders: ['x-request-id'],
    });

    app.setGlobalPrefix('api/v1', {
      exclude: ['health/{*path}', 'api/v1/health/{*path}'],
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalFilters(new AllExceptionsFilter(logger));
    app.useGlobalInterceptors(new LoggingInterceptor(logger), new TransformInterceptor());

    app.enableShutdownHooks();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // 1. API Boot
  it('1. should boot the NestJS application cleanly', () => {
    expect(app).toBeDefined();
  });

  // 2. Liveness Health Endpoint
  it('2. GET /health/liveness should return 200 OK with status: ok', async () => {
    const res = await request(app.getHttpServer()).get('/health/liveness').expect(200);

    expect(res.body).toHaveProperty('data');
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toHaveProperty('requestId');
  });

  // 3. Readiness Health Endpoint (Active probes against Postgres and Redis)
  it('3. GET /health/readiness should probe database and redis and return 200 OK', async () => {
    const res = await request(app.getHttpServer()).get('/health/readiness').expect(200);

    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database).toBe('up');
    expect(res.body.data.redis).toBe('up');
  });

  // 4. Generated x-request-id when absent
  it('4. should auto-generate an RFC 4122 UUIDv4 when x-request-id is omitted', async () => {
    const res = await request(app.getHttpServer()).get('/health/liveness').expect(200);

    const headerId = res.headers['x-request-id'];
    expect(headerId).toBeDefined();
    expect(UUID_V4_REGEX.test(headerId)).toBe(true);
    expect(res.body.meta.requestId).toBe(headerId);
  });

  // 5. Valid custom x-request-id preservation
  it('5. should preserve and reflect valid client-supplied x-request-id', async () => {
    const customId = 'custom-trace-id-12345';
    const res = await request(app.getHttpServer())
      .get('/health/liveness')
      .set('x-request-id', customId)
      .expect(200);

    expect(res.headers['x-request-id']).toBe(customId);
    expect(res.body.meta.requestId).toBe(customId);
  });

  // 6. Oversized / invalid x-request-id replaced with secure UUIDv4
  it('6. should reject oversized (>128 chars) or injection x-request-id and fallback to UUIDv4', async () => {
    const oversizedId = 'a'.repeat(200);
    const resOversized = await request(app.getHttpServer())
      .get('/health/liveness')
      .set('x-request-id', oversizedId)
      .expect(200);

    expect(resOversized.headers['x-request-id']).not.toBe(oversizedId);
    expect(UUID_V4_REGEX.test(resOversized.headers['x-request-id'])).toBe(true);

    const injectionId = 'trace<script>alert(1)</script>';
    const resInjection = await request(app.getHttpServer())
      .get('/health/liveness')
      .set('x-request-id', injectionId)
      .expect(200);

    expect(resInjection.headers['x-request-id']).not.toContain('<script>');
    expect(UUID_V4_REGEX.test(resInjection.headers['x-request-id'])).toBe(true);

    const spacesId = 'invalid id with spaces';
    const resSpaces = await request(app.getHttpServer())
      .get('/health/liveness')
      .set('x-request-id', spacesId)
      .expect(200);

    expect(resSpaces.headers['x-request-id']).not.toBe(spacesId);
    expect(UUID_V4_REGEX.test(resSpaces.headers['x-request-id'])).toBe(true);
  });

  // 7. Unknown DTO property rejection
  it('7. should reject unknown DTO properties with HTTP 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/health/echo-check')
      .send({
        message: 'valid payload',
        unexpectedField: 'forbidden-injection',
      })
      .expect(400);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.message).toContain('property unexpectedField should not exist');
  });

  // 8. Validation error formatted in standard error envelope
  it('8. should format validation errors into the standard error envelope', async () => {
    const res = await request(app.getHttpServer()).post('/health/echo-check').send({}).expect(400);

    expect(res.body).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: expect.stringContaining('message must be a string'),
        requestId: expect.any(String),
        details: expect.any(Array),
      },
    });
  });

  // 9. 404 error envelope on non-existent routes
  it('9. should return controlled 404 error envelope for non-existent routes', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/non-existent-endpoint').expect(404);

    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Cannot GET /api/v1/non-existent-endpoint',
        requestId: expect.any(String),
      },
    });
  });

  // 10. No stack trace or internal error leakage
  it('10. should not expose stack traces or internal exception details', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/invalid-route').expect(404);

    expect(res.body.error).not.toHaveProperty('stack');
    expect(res.body.error).not.toHaveProperty('trace');
    expect(JSON.stringify(res.body)).not.toContain('node_modules');
  });

  // 11. CORS allowed origin reflection
  it('11. should reflect configured allowed origin in Access-Control-Allow-Origin', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/liveness')
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  // 12. CORS unauthorized origin rejection
  it('12. should not return Access-Control-Allow-Origin for unauthorized origins', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/liveness')
      .set('Origin', 'http://malicious-site.com')
      .expect(200);

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  // 13. Credentials + CORS specific origin (never wildcard *)
  it('13. should never return wildcard * for Access-Control-Allow-Origin when credentials are true', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/liveness')
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    expect(res.headers['access-control-allow-origin']).not.toBe('*');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  // 14. Dual path health checks (/health and /api/v1/health)
  it('14. should serve health endpoints on both root and /api/v1 prefixes', async () => {
    const rootLive = await request(app.getHttpServer()).get('/health/liveness').expect(200);
    const apiLive = await request(app.getHttpServer()).get('/api/v1/health/liveness').expect(200);

    expect(rootLive.body.data.status).toBe('ok');
    expect(apiLive.body.data.status).toBe('ok');
  });
});
