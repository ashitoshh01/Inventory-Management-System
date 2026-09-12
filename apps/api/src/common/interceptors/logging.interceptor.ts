import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';
import { RequestWithId } from '../middleware/correlation-id.middleware';
import { StructuredLogger } from '../logger/structured-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: StructuredLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();

    const startTime = Date.now();
    const { method, url } = request;
    const requestId = request.id || 'unknown';

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log(`${method} ${url} ${statusCode} - ${durationMs}ms`, 'HTTP', {
            requestId,
            route: url,
            statusCode,
            durationMs,
          });
        },
        error: () => {
          const durationMs = Date.now() - startTime;
          const statusCode = response.statusCode || 500;

          this.logger.warn(`${method} ${url} failed - ${durationMs}ms`, 'HTTP', {
            requestId,
            route: url,
            statusCode,
            durationMs,
          });
        },
      }),
    );
  }
}
