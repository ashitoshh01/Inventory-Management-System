import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';

export class ProductNotFoundException extends NotFoundException {
  constructor(message = 'Product not found') {
    super({ message, error: 'PRODUCT_NOT_FOUND', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class ProductDuplicateSkuException extends ConflictException {
  constructor(message = 'A product with this SKU already exists in this organization') {
    super({ message, error: 'PRODUCT_DUPLICATE_SKU', statusCode: HttpStatus.CONFLICT });
  }
}

export class ProductValidationException extends BadRequestException {
  constructor(message: string) {
    super({ message, error: 'PRODUCT_VALIDATION_ERROR', statusCode: HttpStatus.BAD_REQUEST });
  }
}

export class InvalidCategoryReferenceException extends BadRequestException {
  constructor(
    message = 'Referenced category does not exist or does not belong to the active organization',
  ) {
    super({ message, error: 'INVALID_CATEGORY_REFERENCE', statusCode: HttpStatus.BAD_REQUEST });
  }
}

export class ProductDeleteConflictException extends ConflictException {
  constructor(message = 'Cannot delete product because it is referenced by other resources') {
    super({ message, error: 'PRODUCT_DELETE_CONFLICT', statusCode: HttpStatus.CONFLICT });
  }
}
