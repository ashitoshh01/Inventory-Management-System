import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';

export class PurchaseOrderNotFoundException extends NotFoundException {
  constructor(message = 'Purchase order not found') {
    super({ message, error: 'PURCHASE_ORDER_NOT_FOUND', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class PurchaseOrderDuplicateNumberException extends ConflictException {
  constructor(poNumber: string) {
    super({
      message: `Purchase order number "${poNumber}" already exists in this organization`,
      error: 'PURCHASE_ORDER_DUPLICATE_NUMBER',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class PurchaseOrderInvalidTransitionException extends BadRequestException {
  constructor(fromState: string, toState: string) {
    super({
      message: `Cannot transition purchase order from state "${fromState}" to "${toState}"`,
      error: 'PURCHASE_ORDER_INVALID_TRANSITION',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class PurchaseOrderInvalidLineException extends BadRequestException {
  constructor(message: string) {
    super({
      message,
      error: 'PURCHASE_ORDER_INVALID_LINE',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class PurchaseOrderCannotDeleteException extends ConflictException {
  constructor(status: string) {
    super({
      message: `Purchase order in status "${status}" cannot be deleted. Only DRAFT purchase orders may be deleted.`,
      error: 'PURCHASE_ORDER_CANNOT_DELETE',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class PurchaseOrderCannotUpdateException extends ConflictException {
  constructor(status: string) {
    super({
      message: `Purchase order in status "${status}" cannot be updated. Only DRAFT purchase orders may be updated.`,
      error: 'PURCHASE_ORDER_CANNOT_UPDATE',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class PurchaseOrderCrossTenantReferenceException extends ForbiddenException {
  constructor(message = 'Referenced resource does not belong to the active organization') {
    super({
      message,
      error: 'PURCHASE_ORDER_CROSS_TENANT_REFERENCE',
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}

export class PurchaseOrderWarehouseNotFoundException extends NotFoundException {
  constructor(message = 'Warehouse not found in this organization') {
    super({
      message,
      error: 'WAREHOUSE_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class PurchaseOrderProductNotFoundException extends NotFoundException {
  constructor(productId: string) {
    super({
      message: `Product "${productId}" not found in this organization`,
      error: 'PRODUCT_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class PurchaseOrderNotApprovedForReceiptException extends BadRequestException {
  constructor(status: string) {
    super({
      message: `Purchase order in status "${status}" cannot receive inventory. Only APPROVED or PARTIALLY_RECEIVED purchase orders may be received.`,
      error: 'PURCHASE_ORDER_NOT_APPROVED_FOR_RECEIPT',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class PurchaseOrderOverReceiptException extends BadRequestException {
  constructor(lineId: string, orderedQty: string, currentReceived: string, requestedQty: string) {
    super({
      message: `Over-receiving is not permitted for line "${lineId}". Ordered: ${orderedQty}, already received: ${currentReceived}, requested: ${requestedQty}`,
      error: 'PURCHASE_ORDER_OVER_RECEIPT_NOT_ALLOWED',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class PurchaseOrderReceiptIdempotencyMismatchException extends ConflictException {
  constructor(
    message = 'Idempotency key has already been used with a different receiving payload',
  ) {
    super({
      message,
      error: 'PURCHASE_ORDER_RECEIPT_IDEMPOTENCY_MISMATCH',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
