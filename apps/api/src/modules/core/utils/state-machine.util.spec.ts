import { StateMachineUtil } from './state-machine.util';
import { InvalidStateTransitionException } from '../errors/domain.errors';

describe('StateMachineUtil (Unit)', () => {
  type OrderStatus = 'DRAFT' | 'PENDING' | 'CONFIRMED' | 'CANCELLED';

  const transitions: Record<OrderStatus, OrderStatus[]> = {
    DRAFT: ['PENDING', 'CANCELLED'],
    PENDING: ['CONFIRMED', 'CANCELLED'],
    CONFIRMED: ['CANCELLED'],
    CANCELLED: [],
  };

  describe('canTransition()', () => {
    it('should allow valid sequential transitions', () => {
      expect(StateMachineUtil.canTransition('DRAFT', 'PENDING', transitions)).toBe(true);
      expect(StateMachineUtil.canTransition('PENDING', 'CONFIRMED', transitions)).toBe(true);
      expect(StateMachineUtil.canTransition('CONFIRMED', 'CANCELLED', transitions)).toBe(true);
    });

    it('should allow identical state transition (no-op)', () => {
      expect(StateMachineUtil.canTransition('DRAFT', 'DRAFT', transitions)).toBe(true);
    });

    it('should deny invalid or backward transitions', () => {
      expect(StateMachineUtil.canTransition('CANCELLED', 'DRAFT', transitions)).toBe(false);
      expect(StateMachineUtil.canTransition('CONFIRMED', 'PENDING', transitions)).toBe(false);
      expect(StateMachineUtil.canTransition('DRAFT', 'CONFIRMED', transitions)).toBe(false);
    });
  });

  describe('assertTransition()', () => {
    it('should not throw on valid transition', () => {
      expect(() =>
        StateMachineUtil.assertTransition('DRAFT', 'PENDING', transitions, 'Order'),
      ).not.toThrow();
    });

    it('should throw InvalidStateTransitionException on invalid transition', () => {
      expect(() =>
        StateMachineUtil.assertTransition('CANCELLED', 'DRAFT', transitions, 'Order'),
      ).toThrow(InvalidStateTransitionException);
    });
  });
});
