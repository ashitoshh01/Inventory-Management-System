export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  corsOrigin: string;
}

export function validateEnv(): AppConfig {
  const port = parseInt(process.env.PORT || '4000', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/inventory_dev?schema=public';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

  return {
    nodeEnv,
    port: isNaN(port) ? 4000 : port,
    databaseUrl,
    redisUrl,
    corsOrigin,
  };
}
