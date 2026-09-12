import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpStatus,
} from '@nestjs/common';

export class StockBalanceNotFoundException extends NotFoundException {
  constructor(message = 'Stock balance not found') {
    super({ message, error: 'STOCK_BALANCE_NOT_FOUND', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class StockInvalidQuantityException extends BadRequestException {
  constructor(message: string) {
    super({ message, error: 'STOCK_INVALID_QUANTITY', statusCode: HttpStatus.BAD_REQUEST });
  }
}

export class StockLedgerImmutableException extends BadRequestException {
  constructor(message = 'Stock ledger entries are immutable and cannot be updated or deleted') {
    super({ message, error: 'STOCK_LEDGER_IMMUTABLE', statusCode: HttpStatus.BAD_REQUEST });
  }
}

export class StockTenantMismatchException extends BadRequestException {
  constructor(message = 'Product and Warehouse must belong to the same organization') {
    super({ message, error: 'STOCK_TENANT_MISMATCH', statusCode: HttpStatus.BAD_REQUEST });
  }
}

export class StockConcurrencyConflictException extends ConflictException {
  constructor(message = 'Concurrent stock mutation detected; please retry transaction') {
    super({ message, error: 'STOCK_CONCURRENCY_CONFLICT', statusCode: HttpStatus.CONFLICT });
  }
}

export class StockInsufficientQuantityException extends ConflictException {
  constructor(message = 'Insufficient stock for this operation; negative stock is prohibited') {
    super({ message, error: 'STOCK_INSUFFICIENT_QUANTITY', statusCode: HttpStatus.CONFLICT });
  }
}

export class StockOpeningBalanceInvalidStateException extends ConflictException {
  constructor(
    message = 'Opening stock can only be established on a zero or uninitialized balance',
  ) {
    super({
      message,
      error: 'STOCK_OPENING_INVALID_STATE',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class StockInvalidMutationTypeException extends BadRequestException {
  constructor(message: string) {
    super({ message, error: 'STOCK_INVALID_MUTATION_TYPE', statusCode: HttpStatus.BAD_REQUEST });
  }
}

export class StockIdempotencyConflictException extends ConflictException {
  constructor(message = 'Idempotency key was previously used with different mutation parameters') {
    super({
      message,
      error: 'STOCK_IDEMPOTENCY_CONFLICT',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class StockProductNotFoundException extends NotFoundException {
  constructor(message = 'Product not found in this organization or is inactive') {
    super({ message, error: 'PRODUCT_NOT_FOUND', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class StockWarehouseNotFoundException extends NotFoundException {
  constructor(message = 'Warehouse not found in this organization or is inactive') {
    super({ message, error: 'WAREHOUSE_NOT_FOUND', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class StockActorNotFoundException extends BadRequestException {
  constructor(message = 'Actor user does not belong to this organization') {
    super({ message, error: 'STOCK_ACTOR_NOT_FOUND', statusCode: HttpStatus.BAD_REQUEST });
  }
}
