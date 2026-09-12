import { InvalidStateTransitionException } from '../errors/domain.errors';

/**
 * State Machine Transition Helper
 * Enforces valid lifecycle transitions across domain entities with finite status states.
 */
export class StateMachineUtil {
  /**
   * Verifies if transitioning from current to next status is permitted.
   */
  static canTransition<T extends string>(
    current: T,
    next: T,
    allowedTransitions: Record<T, readonly T[] | T[]>,
  ): boolean {
    if (current === next) {
      return true; // No-op transition is permitted
    }

    const validNextStates = allowedTransitions[current];
    if (!validNextStates || !Array.isArray(validNextStates)) {
      return false;
    }

    return validNextStates.includes(next);
  }

  /**
   * Asserts valid transition, throwing InvalidStateTransitionException if illegal.
   */
  static assertTransition<T extends string>(
    current: T,
    next: T,
    allowedTransitions: Record<T, readonly T[] | T[]>,
    entityName = 'Entity',
  ): void {
    if (!this.canTransition(current, next, allowedTransitions)) {
      throw new InvalidStateTransitionException(current, next, entityName);
    }
  }
}
