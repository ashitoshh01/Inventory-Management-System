import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpStatus,
} from '@nestjs/common';

export class SalesOrderNotFoundException extends NotFoundException {
  constructor(identifier = 'Sales order') {
    super({
      message: `Sales order "${identifier}" not found`,
      error: 'SALES_ORDER_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class SalesOrderWarehouseNotFoundException extends NotFoundException {
  constructor(warehouseId: string) {
    super({
      message: `Warehouse "${warehouseId}" not found`,
      error: 'WAREHOUSE_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class SalesOrderCustomerNotFoundException extends NotFoundException {
  constructor(customerId: string) {
    super({
      message: `Customer "${customerId}" not found`,
      error: 'CUSTOMER_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class SalesOrderProductNotFoundException extends NotFoundException {
  constructor(productId: string) {
    super({
      message: `Product "${productId}" not found`,
      error: 'PRODUCT_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class SalesOrderDuplicateNumberException extends ConflictException {
  constructor(salesOrderNumber: string) {
    super({
      message: `A sales order with number "${salesOrderNumber}" already exists in this organization`,
      error: 'SALES_ORDER_DUPLICATE_NUMBER',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class SalesOrderIdempotencyConflictException extends ConflictException {
  constructor(key: string) {
    super({
      message: `Idempotency key "${key}" was previously used with a different request payload`,
      error: 'SALES_ORDER_IDEMPOTENCY_CONFLICT',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class SalesOrderInvalidTransitionException extends BadRequestException {
  constructor(fromState: string, toState: string) {
    super({
      message: `Cannot transition sales order from state "${fromState}" to "${toState}"`,
      error: 'SALES_ORDER_INVALID_TRANSITION',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class SalesOrderImmutableStatusException extends ConflictException {
  constructor(status: string, action: string) {
    super({
      message: `Cannot ${action} sales order in "${status}" status; order is immutable`,
      error: 'SALES_ORDER_IMMUTABLE_STATUS',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class SalesOrderFulfillmentException extends ConflictException {
  constructor(message: string) {
    super({
      message,
      error: 'SALES_ORDER_FULFILLMENT_FAILED',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class SalesOrderLineValidationException extends BadRequestException {
  constructor(message: string) {
    super({
      message,
      error: 'SALES_ORDER_INVALID_LINE',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}
