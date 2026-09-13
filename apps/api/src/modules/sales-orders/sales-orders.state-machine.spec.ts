import { SalesOrderStatus } from '@repo/types';
import { SalesOrderStateMachine } from './sales-orders.state-machine';
import { SalesOrderInvalidTransitionException } from './sales-orders.errors';

describe('SalesOrderStateMachine', () => {
  describe('canTransition', () => {
    it('allows DRAFT -> SUBMITTED', () => {
      expect(SalesOrderStateMachine.canTransition('DRAFT', 'SUBMITTED')).toBe(true);
    });

    it('allows DRAFT -> APPROVED (fast-track confirm)', () => {
      expect(SalesOrderStateMachine.canTransition('DRAFT', 'APPROVED')).toBe(true);
    });

    it('allows DRAFT -> CANCELLED', () => {
      expect(SalesOrderStateMachine.canTransition('DRAFT', 'CANCELLED')).toBe(true);
    });

    it('allows SUBMITTED -> APPROVED', () => {
      expect(SalesOrderStateMachine.canTransition('SUBMITTED', 'APPROVED')).toBe(true);
    });

    it('allows SUBMITTED -> DRAFT (revert for revisions)', () => {
      expect(SalesOrderStateMachine.canTransition('SUBMITTED', 'DRAFT')).toBe(true);
    });

    it('allows SUBMITTED -> CANCELLED', () => {
      expect(SalesOrderStateMachine.canTransition('SUBMITTED', 'CANCELLED')).toBe(true);
    });

    it('allows APPROVED -> FULFILLED', () => {
      expect(SalesOrderStateMachine.canTransition('APPROVED', 'FULFILLED')).toBe(true);
    });

    it('allows APPROVED -> CANCELLED', () => {
      expect(SalesOrderStateMachine.canTransition('APPROVED', 'CANCELLED')).toBe(true);
    });

    it('disallows FULFILLED -> anything (terminal)', () => {
      const targets: SalesOrderStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'CANCELLED'];
      for (const target of targets) {
        expect(SalesOrderStateMachine.canTransition('FULFILLED', target)).toBe(false);
      }
    });

    it('disallows CANCELLED -> anything (terminal)', () => {
      const targets: SalesOrderStatus[] = ['DRAFT', 'SUBMITTED', 'APPROVED', 'FULFILLED'];
      for (const target of targets) {
        expect(SalesOrderStateMachine.canTransition('CANCELLED', target)).toBe(false);
      }
    });

    it('disallows self-transitions', () => {
      expect(SalesOrderStateMachine.canTransition('DRAFT', 'DRAFT')).toBe(false);
      expect(SalesOrderStateMachine.canTransition('APPROVED', 'APPROVED')).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('does not throw on valid transition', () => {
      expect(() => SalesOrderStateMachine.assertTransition('DRAFT', 'SUBMITTED')).not.toThrow();
    });

    it('throws SalesOrderInvalidTransitionException on invalid transition', () => {
      expect(() => SalesOrderStateMachine.assertTransition('FULFILLED', 'DRAFT')).toThrow(
        SalesOrderInvalidTransitionException,
      );
    });
  });

  describe('isTerminal', () => {
    it('returns true for FULFILLED and CANCELLED', () => {
      expect(SalesOrderStateMachine.isTerminal('FULFILLED')).toBe(true);
      expect(SalesOrderStateMachine.isTerminal('CANCELLED')).toBe(true);
    });

    it('returns false for non-terminal states', () => {
      expect(SalesOrderStateMachine.isTerminal('DRAFT')).toBe(false);
      expect(SalesOrderStateMachine.isTerminal('SUBMITTED')).toBe(false);
      expect(SalesOrderStateMachine.isTerminal('APPROVED')).toBe(false);
    });
  });
});
