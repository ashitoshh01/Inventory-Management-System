import {
  NotFoundException,
  ConflictException,
  HttpStatus,
} from '@nestjs/common';

export class CustomerNotFoundException extends NotFoundException {
  constructor(identifier: string) {
    super({
      message: `Customer "${identifier}" not found`,
      error: 'CUSTOMER_NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class CustomerHasActiveOrdersException extends ConflictException {
  constructor(customerId: string) {
    super({
      message: `Customer "${customerId}" cannot be deleted because they are associated with existing sales orders`,
      error: 'CUSTOMER_HAS_ACTIVE_ORDERS',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
