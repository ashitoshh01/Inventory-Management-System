import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { RequestWithId } from '../middleware/correlation-id.middleware';
import { StructuredLogger } from '../logger/structured-logger.service';

export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const requestId =
      request.id ||
      (typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : 'unknown');

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An internal server error occurred.';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const errorObj = res as Record<string, unknown>;
        message =
          typeof errorObj.message === 'string'
            ? errorObj.message
            : Array.isArray(errorObj.message)
              ? errorObj.message.join('; ')
              : exception.message;

        if (errorObj.code && typeof errorObj.code === 'string') {
          code = errorObj.code;
        } else if (errorObj.error && typeof errorObj.error === 'string') {
          code = errorObj.error.toUpperCase().replace(/\s+/g, '_');
        } else {
          code = this.getErrorCodeFromStatus(status);
        }

        if (Array.isArray(errorObj.message)) {
          details = errorObj.message;
        }
      }
    } else if (
      exception &&
      typeof exception === 'object' &&
      'code' in exception &&
      typeof (exception as { code: unknown }).code === 'string' &&
      (exception as { code: string }).code.startsWith('P')
    ) {
      // Safe mapping for Prisma Client Known Request Errors without leaking DB details
      const prismaCode = (exception as { code: string }).code;
      switch (prismaCode) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          code = 'DUPLICATE_RESOURCE';
          message = 'A resource with this identifier or unique attribute already exists.';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          code = 'NOT_FOUND';
          message = 'The requested resource was not found.';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          code = 'FOREIGN_KEY_VIOLATION';
          message =
            'Referenced resource does not exist or operation violates relational constraints.';
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          code = 'DATABASE_ERROR';
          message = 'A database operation error occurred.';
          break;
      }
    } else {
      code = 'INTERNAL_SERVER_ERROR';
      message = 'An unexpected internal error occurred.';
    }

    // Log internal 5xx errors with full stack, and client 4xx as warnings
    if (status >= 500) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${message}`,
        exception instanceof Error ? exception.stack : String(exception),
        'AllExceptionsFilter',
        {
          requestId,
          route: request.url,
          statusCode: status,
        },
      );
    } else {
      this.logger.warn(
        `HTTP ${status} on ${request.method} ${request.url}: ${message}`,
        'AllExceptionsFilter',
        {
          requestId,
          route: request.url,
          statusCode: status,
        },
      );
    }

    const errorResponse: ApiErrorEnvelope = {
      error: {
        code,
        message,
        requestId,
        ...(details ? { details } : {}),
      },
    };

    response.status(status).json(errorResponse);
  }

  private getErrorCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'TOO_MANY_REQUESTS';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
