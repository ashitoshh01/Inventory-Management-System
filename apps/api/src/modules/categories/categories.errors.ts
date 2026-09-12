import { NotFoundException, ConflictException, HttpStatus } from '@nestjs/common';

export class CategoryNotFoundException extends NotFoundException {
  constructor(message = 'Category not found') {
    super({ message, error: 'CATEGORY_NOT_FOUND', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class CategoryDuplicateException extends ConflictException {
  constructor(message = 'Category with this name already exists in this organization') {
    super({ message, error: 'CATEGORY_DUPLICATE', statusCode: HttpStatus.CONFLICT });
  }
}

export class CategoryDeleteConflictException extends ConflictException {
  constructor(message = 'Cannot delete category because it is referenced by other resources') {
    super({ message, error: 'CATEGORY_DELETE_CONFLICT', statusCode: HttpStatus.CONFLICT });
  }
}
