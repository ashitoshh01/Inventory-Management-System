/**
 * Backend API Application (@repo/api)
 * NestJS application entrypoint and core module exports.
 */

export * from './app.module';
export * from './common/logger/structured-logger.service';
export * from './common/filters/all-exceptions.filter';
export * from './common/interceptors/transform.interceptor';
export * from './common/interceptors/logging.interceptor';
export * from './modules/health/health.module';
export * from './modules/health/health.service';

export const API_APP_NAME = 'api';
