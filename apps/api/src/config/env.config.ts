export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  corsOrigin: string;
  cloudinaryUrl?: string | undefined;
  cloudinaryCloudName?: string | undefined;
  cloudinaryApiKey?: string | undefined;
  cloudinaryApiSecret?: string | undefined;
  storageProvider?: string | undefined;
}

export function validateEnv(): AppConfig {
  const port = parseInt(process.env.PORT || '4000', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/inventory_dev?schema=public';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const cloudinaryUrl = process.env.CLOUDINARY_URL;
  const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
  const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;
  const storageProvider = process.env.STORAGE_PROVIDER || (cloudinaryUrl ? 'cloudinary' : 'local');

  return {
    nodeEnv,
    port: isNaN(port) ? 4000 : port,
    databaseUrl,
    redisUrl,
    corsOrigin,
    cloudinaryUrl,
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
    storageProvider,
  };
}
