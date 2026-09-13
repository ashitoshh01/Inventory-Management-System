import { StockTransferStateMachine } from './transfers.state-machine';
import { StockTransferInvalidTransitionException } from './transfers.errors';
import { StockTransferStatus } from '@repo/types';

describe('StockTransferStateMachine (Unit)', () => {
  describe('canTransition', () => {
    it('permits valid lifecycle forward transitions', () => {
      expect(StockTransferStateMachine.canTransition('DRAFT', 'APPROVED')).toBe(true);
      expect(StockTransferStateMachine.canTransition('DRAFT', 'CANCELLED')).toBe(true);
      expect(StockTransferStateMachine.canTransition('APPROVED', 'IN_TRANSIT')).toBe(true);
      expect(StockTransferStateMachine.canTransition('APPROVED', 'CANCELLED')).toBe(true);
      expect(StockTransferStateMachine.canTransition('IN_TRANSIT', 'RECEIVED')).toBe(true);
    });

    it('rejects self-transitions', () => {
      expect(StockTransferStateMachine.canTransition('DRAFT', 'DRAFT')).toBe(false);
      expect(StockTransferStateMachine.canTransition('APPROVED', 'APPROVED')).toBe(false);
      expect(StockTransferStateMachine.canTransition('IN_TRANSIT', 'IN_TRANSIT')).toBe(false);
      expect(StockTransferStateMachine.canTransition('RECEIVED', 'RECEIVED')).toBe(false);
      expect(StockTransferStateMachine.canTransition('CANCELLED', 'CANCELLED')).toBe(false);
    });

    it('rejects backwards and illegal state skips', () => {
      expect(StockTransferStateMachine.canTransition('DRAFT', 'IN_TRANSIT')).toBe(false);
      expect(StockTransferStateMachine.canTransition('DRAFT', 'RECEIVED')).toBe(false);
      expect(StockTransferStateMachine.canTransition('APPROVED', 'DRAFT')).toBe(false);
      expect(StockTransferStateMachine.canTransition('APPROVED', 'RECEIVED')).toBe(false);
      expect(StockTransferStateMachine.canTransition('IN_TRANSIT', 'DRAFT')).toBe(false);
      expect(StockTransferStateMachine.canTransition('IN_TRANSIT', 'APPROVED')).toBe(false);
      expect(StockTransferStateMachine.canTransition('IN_TRANSIT', 'CANCELLED')).toBe(false);
      expect(StockTransferStateMachine.canTransition('RECEIVED', 'DRAFT')).toBe(false);
      expect(StockTransferStateMachine.canTransition('RECEIVED', 'IN_TRANSIT')).toBe(false);
      expect(StockTransferStateMachine.canTransition('CANCELLED', 'DRAFT')).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('succeeds silently for legal transitions', () => {
      expect(() => StockTransferStateMachine.assertTransition('DRAFT', 'APPROVED')).not.toThrow();
      expect(() =>
        StockTransferStateMachine.assertTransition('APPROVED', 'IN_TRANSIT'),
      ).not.toThrow();
      expect(() =>
        StockTransferStateMachine.assertTransition('IN_TRANSIT', 'RECEIVED'),
      ).not.toThrow();
    });

    it('throws StockTransferInvalidTransitionException for illegal transitions', () => {
      expect(() => StockTransferStateMachine.assertTransition('RECEIVED', 'DRAFT')).toThrow(
        StockTransferInvalidTransitionException,
      );

      expect(() => StockTransferStateMachine.assertTransition('IN_TRANSIT', 'CANCELLED')).toThrow(
        StockTransferInvalidTransitionException,
      );
    });
  });

  describe('isTerminal', () => {
    it('identifies RECEIVED and CANCELLED as terminal states', () => {
      expect(StockTransferStateMachine.isTerminal('RECEIVED')).toBe(true);
      expect(StockTransferStateMachine.isTerminal('CANCELLED')).toBe(true);
    });

    it('identifies non-terminal states correctly', () => {
      const nonTerminal: StockTransferStatus[] = ['DRAFT', 'APPROVED', 'IN_TRANSIT'];
      for (const status of nonTerminal) {
        expect(StockTransferStateMachine.isTerminal(status)).toBe(false);
      }
    });
  });
});
