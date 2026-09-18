import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './worker.module';
import { StructuredLogger } from './common/logger/structured-logger.service';

async function bootstrap(): Promise<void> {
  const logger = new StructuredLogger();
  logger.log(
    `Starting Inventory Worker Service in ${process.env.NODE_ENV || 'development'} mode...`,
    'WorkerBootstrap',
  );

  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    bufferLogs: true,
    logger,
  });

  app.useLogger(logger);
  app.enableShutdownHooks();

  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.log(`Received ${signal}. Shutting down Inventory Worker Service gracefully...`, 'WorkerBootstrap');
    try {
      await app.close();
      logger.log('Inventory Worker Service shutdown complete.', 'WorkerBootstrap');
      process.exit(0);
    } catch (err) {
      logger.error(`Error during worker shutdown: ${err instanceof Error ? err.message : String(err)}`, 'WorkerBootstrap');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  logger.log('Inventory Worker Service is running and listening for queue jobs.', 'WorkerBootstrap');
}

bootstrap().catch((err) => {
  console.error('FATAL WORKER BOOTSTRAP ERROR:', err);
  process.exit(1);
});
