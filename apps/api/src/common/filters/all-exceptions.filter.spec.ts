import { HttpStatus, NotFoundException, ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { StructuredLogger } from '../logger/structured-logger.service';

describe('AllExceptionsFilter (Unit)', () => {
  let filter: AllExceptionsFilter;
  let mockLogger: StructuredLogger;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockRequest: {
    id: string;
    url: string;
    method: string;
    headers: Record<string, string>;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
    } as unknown as StructuredLogger;

    filter = new AllExceptionsFilter(mockLogger);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      id: 'test-req-id-1234',
      url: '/api/v1/test',
      method: 'POST',
      headers: {},
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should format standard HttpException into consistent API error envelope', () => {
    const exception = new NotFoundException('Resource was not found');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource was not found',
        requestId: 'test-req-id-1234',
      },
    });
  });

  it('should map Prisma P2002 unique constraint error to HTTP 409 Conflict without leaking DB details', () => {
    const prismaError = {
      code: 'P2002',
      meta: { target: ['email'] },
      message: 'Unique constraint failed on the fields: (`email`)',
    };

    filter.catch(prismaError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'DUPLICATE_RESOURCE',
        message: 'A resource with this identifier or unique attribute already exists.',
        requestId: 'test-req-id-1234',
      },
    });
  });

  it('should map Prisma P2025 record not found to HTTP 404 Not Found', () => {
    const prismaError = {
      code: 'P2025',
      message: 'Record to update not found.',
    };

    filter.catch(prismaError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        requestId: 'test-req-id-1234',
      },
    });
  });

  it('should map Prisma P2003 foreign key violation to HTTP 400 Bad Request', () => {
    const prismaError = {
      code: 'P2003',
      message: 'Foreign key constraint violated',
    };

    filter.catch(prismaError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Referenced resource does not exist or operation violates relational constraints.',
        requestId: 'test-req-id-1234',
      },
    });
  });

  it('should mask unhandled errors as generic 500 without leaking stack traces or internal secrets', () => {
    const secretError = new Error('Database password was incorrect in connection string: postgres://postgres:pwd@db');

    filter.catch(secretError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred.',
        requestId: 'test-req-id-1234',
      },
    });
  });
});
