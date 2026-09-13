import { SalesOrderStatus } from '@repo/types';
import { SalesOrderInvalidTransitionException } from './sales-orders.errors';

export const SALES_ORDER_TRANSITIONS: Record<
  SalesOrderStatus,
  readonly SalesOrderStatus[]
> = {
  DRAFT: ['SUBMITTED', 'APPROVED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['FULFILLED', 'CANCELLED'],
  FULFILLED: [],
  CANCELLED: [],
};

export class SalesOrderStateMachine {
  /**
   * Checks whether a status transition is permitted.
   * Self-transitions (current === next) are not valid lifecycle operations.
   */
  static canTransition(current: SalesOrderStatus, next: SalesOrderStatus): boolean {
    if (current === next) {
      return false;
    }
    const validNextStates = SALES_ORDER_TRANSITIONS[current];
    return Array.isArray(validNextStates) && validNextStates.includes(next);
  }

  /**
   * Asserts that a status transition is permitted, throwing SalesOrderInvalidTransitionException if invalid.
   */
  static assertTransition(current: SalesOrderStatus, next: SalesOrderStatus): void {
    if (!this.canTransition(current, next)) {
      throw new SalesOrderInvalidTransitionException(current, next);
    }
  }

  /**
   * Returns true if the status is a terminal state (no further transitions allowed).
   */
  static isTerminal(status: SalesOrderStatus): boolean {
    const transitions = SALES_ORDER_TRANSITIONS[status];
    return Array.isArray(transitions) && transitions.length === 0;
  }
}
