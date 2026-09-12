import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';

export class WarehouseNotFoundException extends NotFoundException {
  constructor(message = 'Warehouse not found') {
    super({ message, error: 'WAREHOUSE_NOT_FOUND', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class WarehouseDuplicateNameException extends ConflictException {
  constructor(message = 'A warehouse with this name already exists in this organization') {
    super({ message, error: 'WAREHOUSE_DUPLICATE_NAME', statusCode: HttpStatus.CONFLICT });
  }
}

export class WarehouseDuplicateCodeException extends ConflictException {
  constructor(message = 'A warehouse with this code already exists in this organization') {
    super({ message, error: 'WAREHOUSE_DUPLICATE_CODE', statusCode: HttpStatus.CONFLICT });
  }
}

export class WarehouseValidationException extends BadRequestException {
  constructor(message: string) {
    super({ message, error: 'WAREHOUSE_VALIDATION_ERROR', statusCode: HttpStatus.BAD_REQUEST });
  }
}

export class WarehouseDeleteConflictException extends ConflictException {
  constructor(
    message = 'Cannot delete warehouse because it is designated as the default warehouse',
  ) {
    super({ message, error: 'WAREHOUSE_DELETE_CONFLICT', statusCode: HttpStatus.CONFLICT });
  }
}
