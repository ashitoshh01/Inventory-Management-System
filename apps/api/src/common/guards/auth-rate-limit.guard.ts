import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
  SetMetadata,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import Redis from 'ioredis';

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  keyPrefix?: string;
}

export const RATE_LIMIT_KEY = 'auth_rate_limit';

export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly logger = new Logger(AuthRateLimitGuard.name);
  private redisClient: Redis | null = null;
  private isRedisAvailable = false;
  private readonly memoryStore = new Map<string, { count: number; resetTime: number }>();

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.initRedis();
  }

  private initRedis() {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
      this.redisClient = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 1000,
        enableOfflineQueue: false,
      });

      this.redisClient
        .connect()
        .then(() => {
          this.isRedisAvailable = true;
        })
        .catch(() => {
          this.isRedisAvailable = false;
        });

      this.redisClient.on('error', () => {
        this.isRedisAvailable = false;
      });
      this.redisClient.on('ready', () => {
        this.isRedisAvailable = true;
      });
    } catch {
      this.isRedisAvailable = false;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rateLimit = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!rateLimit) {
      return true;
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const ip = this.getClientIp(req);
    const keyPrefix = rateLimit.keyPrefix || req.route?.path || req.path;
    const key = `ratelimit:${keyPrefix}:${ip}`;

    const { count, ttlSeconds } = await this.increment(key, rateLimit.windowSeconds);

    const remaining = Math.max(0, rateLimit.limit - count);
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-RateLimit-Limit', rateLimit.limit);
      res.setHeader('X-RateLimit-Remaining', remaining);
    }

    if (count > rateLimit.limit) {
      if (res && typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', ttlSeconds);
      }
      throw new HttpException(
        {
          error: 'TOO_MANY_REQUESTS',
          message: 'Too many authentication attempts. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]!.trim();
    }
    return req.socket?.remoteAddress || '127.0.0.1';
  }

  private async increment(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; ttlSeconds: number }> {
    if (this.isRedisAvailable && this.redisClient) {
      try {
        const count = await this.redisClient.incr(key);
        if (count === 1) {
          await this.redisClient.expire(key, windowSeconds);
        }
        const ttl = await this.redisClient.ttl(key);
        return { count, ttlSeconds: Math.max(1, ttl) };
      } catch (err) {
        this.logger.warn(`Redis rate limiter error, falling back to in-memory: ${err}`);
      }
    }

    // In-memory fallback
    const now = Date.now();
    const entry = this.memoryStore.get(key);

    if (!entry || entry.resetTime <= now) {
      const resetTime = now + windowSeconds * 1000;
      this.memoryStore.set(key, { count: 1, resetTime });
      return { count: 1, ttlSeconds: windowSeconds };
    }

    entry.count += 1;
    const ttlSeconds = Math.max(1, Math.ceil((entry.resetTime - now) / 1000));
    return { count: entry.count, ttlSeconds };
  }

  // Helper for test cleanup
  _resetMemoryStore() {
    this.memoryStore.clear();
  }
}
