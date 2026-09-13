import { StockTransferStatus } from '@repo/types';
import { StockTransferInvalidTransitionException } from './transfers.errors';

export const STOCK_TRANSFER_TRANSITIONS: Record<
  StockTransferStatus,
  readonly StockTransferStatus[]
> = {
  DRAFT: ['APPROVED', 'CANCELLED'],
  APPROVED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: [],
  CANCELLED: [],
};

export class StockTransferStateMachine {
  /**
   * Checks whether a status transition is permitted.
   * Self-transitions (current === next) are not valid lifecycle operations.
   */
  static canTransition(current: StockTransferStatus, next: StockTransferStatus): boolean {
    if (current === next) {
      return false;
    }
    const validNextStates = STOCK_TRANSFER_TRANSITIONS[current];
    return Array.isArray(validNextStates) && validNextStates.includes(next);
  }

  /**
   * Asserts that a status transition is permitted, throwing StockTransferInvalidTransitionException if invalid.
   */
  static assertTransition(current: StockTransferStatus, next: StockTransferStatus): void {
    if (!this.canTransition(current, next)) {
      throw new StockTransferInvalidTransitionException(current, next);
    }
  }

  /**
   * Returns true if the status is a terminal state (no further transitions allowed).
   */
  static isTerminal(status: StockTransferStatus): boolean {
    const transitions = STOCK_TRANSFER_TRANSITIONS[status];
    return Array.isArray(transitions) && transitions.length === 0;
  }
}
