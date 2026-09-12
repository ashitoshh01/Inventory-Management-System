import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

export interface RequestWithId extends Request {
  id?: string;
}

/**
 * Valid correlation ID pattern:
 * - 1 to 128 characters
 * - Alphanumeric, hyphen, underscore, dot only
 * - Strictly prevents CR, LF, control characters, quotes, and log/header injection
 */
const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_.-]{1,128}$/;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const rawHeader = req.headers['x-request-id'];
    let correlationId: string;

    if (
      typeof rawHeader === 'string' &&
      rawHeader.length > 0 &&
      rawHeader.length <= 128 &&
      SAFE_REQUEST_ID_REGEX.test(rawHeader)
    ) {
      // Safe, valid correlation ID supplied by client
      correlationId = rawHeader;
    } else {
      // Missing, oversized, or malformed ID: generate a secure RFC 4122 UUIDv4
      correlationId = randomUUID();
    }

    req.id = correlationId;
    res.setHeader('x-request-id', correlationId);
    next();
  }
}
