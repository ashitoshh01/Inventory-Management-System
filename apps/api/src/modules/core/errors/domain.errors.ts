import {
  NotFoundException,
  ConflictException as NestConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

/**
 * Standard domain error when a requested entity does not exist within the active tenant context.
 * Does not expose whether the entity exists in another tenant.
 */
export class EntityNotFoundException extends NotFoundException {
  constructor(entityName = 'Resource') {
    super(`${entityName} not found`);
  }
}

/**
 * Standard domain error when an operation violates unique or conflicting state constraints.
 */
export class ConflictException extends NestConflictException {
  constructor(message = 'A conflict occurred with the current state of the resource') {
    super(message);
  }
}

/**
 * Standard domain error when an operation violates tenant isolation or boundaries.
 */
export class TenantViolationException extends ForbiddenException {
  constructor(message = 'Access denied for the specified organization context') {
    super(message);
  }
}

/**
 * Standard domain error when an invalid entity lifecycle or status transition is requested.
 */
export class InvalidStateTransitionException extends BadRequestException {
  constructor(fromState: string, toState: string, entityName = 'Entity') {
    super(`Cannot transition ${entityName} from state "${fromState}" to "${toState}"`);
  }
}
