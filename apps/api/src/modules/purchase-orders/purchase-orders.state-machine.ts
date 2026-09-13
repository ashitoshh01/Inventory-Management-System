import { PurchaseOrderStatus } from '@repo/types';
import { PurchaseOrderInvalidTransitionException } from './purchase-orders.errors';

export const PURCHASE_ORDER_TRANSITIONS: Record<
  PurchaseOrderStatus,
  readonly PurchaseOrderStatus[]
> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'DRAFT'],
  APPROVED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CLOSED', 'CANCELLED'],
  RECEIVED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export class PurchaseOrderStateMachine {
  /**
   * Checks whether a status transition is permitted.
   * Self-transitions (current === next) are not valid lifecycle operations.
   */
  static canTransition(current: PurchaseOrderStatus, next: PurchaseOrderStatus): boolean {
    if (current === next) {
      return false;
    }
    const validNextStates = PURCHASE_ORDER_TRANSITIONS[current];
    return Array.isArray(validNextStates) && validNextStates.includes(next);
  }

  /**
   * Asserts that a status transition is permitted, throwing PurchaseOrderInvalidTransitionException if invalid.
   */
  static assertTransition(current: PurchaseOrderStatus, next: PurchaseOrderStatus): void {
    if (!this.canTransition(current, next)) {
      throw new PurchaseOrderInvalidTransitionException(current, next);
    }
  }

  /**
   * Returns true if the status is a terminal state (no further transitions allowed).
   */
  static isTerminal(status: PurchaseOrderStatus): boolean {
    const transitions = PURCHASE_ORDER_TRANSITIONS[status];
    return Array.isArray(transitions) && transitions.length === 0;
  }
}
