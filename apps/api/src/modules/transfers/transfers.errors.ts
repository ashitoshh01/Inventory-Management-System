import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';

export class StockTransferNotFoundException extends NotFoundException {
  constructor(message = 'Stock transfer not found') {
    super({ message, error: 'STOCK_TRANSFER_NOT_FOUND', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class StockTransferDuplicateNumberException extends ConflictException {
  constructor(transferNumber: string) {
    super({
      message: `Stock transfer number "${transferNumber}" already exists in this organization`,
      error: 'STOCK_TRANSFER_DUPLICATE_NUMBER',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class StockTransferSameWarehouseException extends BadRequestException {
  constructor(message = 'Source and destination warehouses cannot be the same') {
    super({
      message,
      error: 'STOCK_TRANSFER_SAME_WAREHOUSE',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class StockTransferWarehouseNotFoundException extends NotFoundException {
  constructor(message = 'Warehouse not found or inactive in this organization') {
    super({
      message,
      error: 'WAREHOUSE_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class StockTransferProductNotFoundException extends NotFoundException {
  constructor(productId: string) {
    super({
      message: `Product "${productId}" not found or inactive in this organization`,
      error: 'PRODUCT_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class StockTransferInvalidTransitionException extends BadRequestException {
  constructor(fromState: string, toState: string) {
    super({
      message: `Cannot transition stock transfer from state "${fromState}" to "${toState}"`,
      error: 'STOCK_TRANSFER_INVALID_TRANSITION',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class StockTransferInvalidLineException extends BadRequestException {
  constructor(message: string) {
    super({
      message,
      error: 'STOCK_TRANSFER_INVALID_LINE',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class StockTransferCannotDeleteException extends ConflictException {
  constructor(status: string) {
    super({
      message: `Stock transfer in status "${status}" cannot be deleted. Only DRAFT stock transfers may be deleted.`,
      error: 'STOCK_TRANSFER_CANNOT_DELETE',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class StockTransferCannotUpdateException extends ConflictException {
  constructor(status: string) {
    super({
      message: `Stock transfer in status "${status}" cannot be updated. Only DRAFT stock transfers may be updated.`,
      error: 'STOCK_TRANSFER_CANNOT_UPDATE',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class StockTransferCrossTenantReferenceException extends ForbiddenException {
  constructor(message = 'Referenced resource does not belong to the active organization') {
    super({
      message,
      error: 'STOCK_TRANSFER_CROSS_TENANT_REFERENCE',
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}

export class StockTransferIdempotencyConflictException extends ConflictException {
  constructor(message = 'Idempotency key was previously used with different request parameters') {
    super({
      message,
      error: 'STOCK_TRANSFER_IDEMPOTENCY_CONFLICT',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
