import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { StructuredLogger } from './common/logger/structured-logger.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const logger = new StructuredLogger();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger,
  });

  // 1. Security Headers via Helmet
  app.use(helmet());
  app.use(cookieParser());

  // 2. Cross-Origin Resource Sharing (CORS) Hardening
  const envOrigins = process.env.CORS_ORIGIN;
  const isProduction = process.env.NODE_ENV === 'production';

  const defaultDevOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const allowedOrigins = envOrigins
    ? envOrigins
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : isProduction
      ? [] // In production, require explicitly configured origins
      : defaultDevOrigins;

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Disallow unauthorized origins
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'Idempotency-Key', 'x-organization-id'],
    exposedHeaders: ['x-request-id'],
  });

  // 3. API Global Prefix (exclude root and versioned health check endpoints)
  app.setGlobalPrefix('api/v1', {
    exclude: ['health/{*path}', 'api/v1/health/{*path}'],
  });

  // 4. Strict Global Validation Pipe
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

  // 5. Global Exception Filter (standardizing all error shapes)
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // 6. Global Interceptors (logging duration & transforming response envelopes)
  app.useGlobalInterceptors(new LoggingInterceptor(logger), new TransformInterceptor());

  // 7. Enable Graceful Shutdown Hooks
  app.enableShutdownHooks();

  // Listen for process termination signals to log clean shutdown
  process.on('SIGTERM', () => {
    logger.log('SIGTERM signal received: closing HTTP server gracefully', 'Shutdown');
  });
  process.on('SIGINT', () => {
    logger.log('SIGINT signal received: closing HTTP server gracefully', 'Shutdown');
  });

  const port = parseInt(process.env.PORT || '4000', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(
    `Inventory API successfully started on port ${port} in ${process.env.NODE_ENV || 'development'} mode`,
    'Bootstrap',
    {
      route: `http://0.0.0.0:${port}/api/v1`,
      statusCode: 200,
    },
  );
}

bootstrap().catch((err) => {
  const logger = new StructuredLogger();
  logger.error(
    `Fatal error during application bootstrap: ${err instanceof Error ? err.message : String(err)}`,
    err instanceof Error ? err.stack : undefined,
    'Bootstrap',
  );
  process.exit(1);
});
