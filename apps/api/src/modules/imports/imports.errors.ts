import {
  NotFoundException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';

export class ImportJobNotFoundException extends NotFoundException {
  constructor(message = 'Import job not found') {
    super({ message, error: 'IMPORT_JOB_NOT_FOUND', statusCode: HttpStatus.NOT_FOUND });
  }
}

export class ImportInvalidFileException extends BadRequestException {
  constructor(message = 'Invalid import file') {
    super({ message, error: 'IMPORT_INVALID_FILE', statusCode: HttpStatus.BAD_REQUEST });
  }
}

export class ImportEmptyFileException extends BadRequestException {
  constructor(message = 'The uploaded import file is empty or contains no data rows') {
    super({ message, error: 'IMPORT_EMPTY_FILE', statusCode: HttpStatus.BAD_REQUEST });
  }
}

export class ImportInvalidHeadersException extends BadRequestException {
  constructor(message: string, missingHeaders?: string[]) {
    super({
      message,
      error: 'IMPORT_INVALID_HEADERS',
      statusCode: HttpStatus.BAD_REQUEST,
      ...(missingHeaders ? { missingHeaders } : {}),
    });
  }
}

export class ImportExceededRowLimitException extends BadRequestException {
  constructor(message = 'Import file exceeds maximum allowed rows') {
    super({ message, error: 'IMPORT_EXCEEDED_ROW_LIMIT', statusCode: HttpStatus.BAD_REQUEST });
  }
}
