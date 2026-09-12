import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RequestWithId } from '../middleware/correlation-id.middleware';

export interface ApiResponseEnvelope<T> {
  data: T;
  meta: {
    requestId: string;
    [key: string]: unknown;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponseEnvelope<T> | T> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponseEnvelope<T> | T> {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const requestId =
      request.id ||
      (typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : 'unknown');

    return next.handle().pipe(
      map((res: unknown) => {
        // If response is already an envelope with data and meta, pass through and guarantee requestId
        if (res !== null && typeof res === 'object' && 'data' in res) {
          const typedRes = res as { data: T; meta?: Record<string, unknown> };
          return {
            data: typedRes.data,
            meta: {
              requestId,
              ...(typedRes.meta || {}),
            },
          };
        }

        // Otherwise, wrap the raw response
        return {
          data: res as T,
          meta: {
            requestId,
          },
        };
      }),
    );
  }
}
