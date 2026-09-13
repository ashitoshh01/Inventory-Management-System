import { PurchaseOrderStatus } from '@repo/types';
import {
  PurchaseOrderStateMachine,
  PURCHASE_ORDER_TRANSITIONS,
} from './purchase-orders.state-machine';
import { PurchaseOrderInvalidTransitionException } from './purchase-orders.errors';

describe('PurchaseOrderStateMachine', () => {
  describe('Valid lifecycle transitions', () => {
    it('allows DRAFT -> SUBMITTED', () => {
      expect(PurchaseOrderStateMachine.canTransition('DRAFT', 'SUBMITTED')).toBe(true);
      expect(() => PurchaseOrderStateMachine.assertTransition('DRAFT', 'SUBMITTED')).not.toThrow();
    });

    it('allows DRAFT -> CANCELLED', () => {
      expect(PurchaseOrderStateMachine.canTransition('DRAFT', 'CANCELLED')).toBe(true);
      expect(() => PurchaseOrderStateMachine.assertTransition('DRAFT', 'CANCELLED')).not.toThrow();
    });

    it('allows SUBMITTED -> APPROVED', () => {
      expect(PurchaseOrderStateMachine.canTransition('SUBMITTED', 'APPROVED')).toBe(true);
      expect(() =>
        PurchaseOrderStateMachine.assertTransition('SUBMITTED', 'APPROVED'),
      ).not.toThrow();
    });

    it('allows SUBMITTED -> DRAFT (returned for revision)', () => {
      expect(PurchaseOrderStateMachine.canTransition('SUBMITTED', 'DRAFT')).toBe(true);
      expect(() => PurchaseOrderStateMachine.assertTransition('SUBMITTED', 'DRAFT')).not.toThrow();
    });

    it('disallows SUBMITTED -> CANCELLED (must be returned to DRAFT first)', () => {
      expect(PurchaseOrderStateMachine.canTransition('SUBMITTED', 'CANCELLED')).toBe(false);
      expect(() => PurchaseOrderStateMachine.assertTransition('SUBMITTED', 'CANCELLED')).toThrow(
        PurchaseOrderInvalidTransitionException,
      );
    });

    it('allows APPROVED -> PARTIALLY_RECEIVED', () => {
      expect(PurchaseOrderStateMachine.canTransition('APPROVED', 'PARTIALLY_RECEIVED')).toBe(true);
      expect(() =>
        PurchaseOrderStateMachine.assertTransition('APPROVED', 'PARTIALLY_RECEIVED'),
      ).not.toThrow();
    });

    it('allows APPROVED -> RECEIVED (full delivery in single receipt)', () => {
      expect(PurchaseOrderStateMachine.canTransition('APPROVED', 'RECEIVED')).toBe(true);
      expect(() =>
        PurchaseOrderStateMachine.assertTransition('APPROVED', 'RECEIVED'),
      ).not.toThrow();
    });

    it('allows APPROVED -> CANCELLED (supplier cannot fulfill)', () => {
      expect(PurchaseOrderStateMachine.canTransition('APPROVED', 'CANCELLED')).toBe(true);
      expect(() =>
        PurchaseOrderStateMachine.assertTransition('APPROVED', 'CANCELLED'),
      ).not.toThrow();
    });

    it('allows PARTIALLY_RECEIVED -> RECEIVED', () => {
      expect(PurchaseOrderStateMachine.canTransition('PARTIALLY_RECEIVED', 'RECEIVED')).toBe(true);
      expect(() =>
        PurchaseOrderStateMachine.assertTransition('PARTIALLY_RECEIVED', 'RECEIVED'),
      ).not.toThrow();
    });

    it('allows PARTIALLY_RECEIVED -> CLOSED', () => {
      expect(PurchaseOrderStateMachine.canTransition('PARTIALLY_RECEIVED', 'CLOSED')).toBe(true);
      expect(() =>
        PurchaseOrderStateMachine.assertTransition('PARTIALLY_RECEIVED', 'CLOSED'),
      ).not.toThrow();
    });

    it('allows PARTIALLY_RECEIVED -> CANCELLED', () => {
      expect(PurchaseOrderStateMachine.canTransition('PARTIALLY_RECEIVED', 'CANCELLED')).toBe(true);
      expect(() =>
        PurchaseOrderStateMachine.assertTransition('PARTIALLY_RECEIVED', 'CANCELLED'),
      ).not.toThrow();
    });

    it('allows RECEIVED -> CLOSED', () => {
      expect(PurchaseOrderStateMachine.canTransition('RECEIVED', 'CLOSED')).toBe(true);
      expect(() => PurchaseOrderStateMachine.assertTransition('RECEIVED', 'CLOSED')).not.toThrow();
    });
  });

  describe('Self-transitions (disallowed)', () => {
    const statuses: PurchaseOrderStatus[] = [
      'DRAFT',
      'SUBMITTED',
      'APPROVED',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'CLOSED',
      'CANCELLED',
    ];

    it.each(statuses)('disallows %s -> %s as an invalid lifecycle transition', (status) => {
      expect(PurchaseOrderStateMachine.canTransition(status, status)).toBe(false);
      expect(() => PurchaseOrderStateMachine.assertTransition(status, status)).toThrow(
        PurchaseOrderInvalidTransitionException,
      );
    });
  });

  describe('Invalid transitions', () => {
    it('disallows RECEIVED -> DRAFT', () => {
      expect(PurchaseOrderStateMachine.canTransition('RECEIVED', 'DRAFT')).toBe(false);
      expect(() => PurchaseOrderStateMachine.assertTransition('RECEIVED', 'DRAFT')).toThrow(
        PurchaseOrderInvalidTransitionException,
      );
    });

    it('disallows DRAFT -> RECEIVED (skipping submission/approval)', () => {
      expect(PurchaseOrderStateMachine.canTransition('DRAFT', 'RECEIVED')).toBe(false);
      expect(() => PurchaseOrderStateMachine.assertTransition('DRAFT', 'RECEIVED')).toThrow(
        PurchaseOrderInvalidTransitionException,
      );
    });

    it('disallows DRAFT -> APPROVED (skipping submission)', () => {
      expect(PurchaseOrderStateMachine.canTransition('DRAFT', 'APPROVED')).toBe(false);
      expect(() => PurchaseOrderStateMachine.assertTransition('DRAFT', 'APPROVED')).toThrow(
        PurchaseOrderInvalidTransitionException,
      );
    });

    it('disallows CLOSED -> DRAFT', () => {
      expect(PurchaseOrderStateMachine.canTransition('CLOSED', 'DRAFT')).toBe(false);
      expect(() => PurchaseOrderStateMachine.assertTransition('CLOSED', 'DRAFT')).toThrow(
        PurchaseOrderInvalidTransitionException,
      );
    });

    it('disallows CANCELLED -> APPROVED', () => {
      expect(PurchaseOrderStateMachine.canTransition('CANCELLED', 'APPROVED')).toBe(false);
      expect(() => PurchaseOrderStateMachine.assertTransition('CANCELLED', 'APPROVED')).toThrow(
        PurchaseOrderInvalidTransitionException,
      );
    });
  });

  describe('Terminal states', () => {
    it('identifies CLOSED as a terminal state', () => {
      expect(PurchaseOrderStateMachine.isTerminal('CLOSED')).toBe(true);
      expect(PURCHASE_ORDER_TRANSITIONS.CLOSED).toEqual([]);
    });

    it('identifies CANCELLED as a terminal state', () => {
      expect(PurchaseOrderStateMachine.isTerminal('CANCELLED')).toBe(true);
      expect(PURCHASE_ORDER_TRANSITIONS.CANCELLED).toEqual([]);
    });

    it('identifies non-terminal states', () => {
      expect(PurchaseOrderStateMachine.isTerminal('DRAFT')).toBe(false);
      expect(PurchaseOrderStateMachine.isTerminal('SUBMITTED')).toBe(false);
      expect(PurchaseOrderStateMachine.isTerminal('APPROVED')).toBe(false);
      expect(PurchaseOrderStateMachine.isTerminal('PARTIALLY_RECEIVED')).toBe(false);
      expect(PurchaseOrderStateMachine.isTerminal('RECEIVED')).toBe(false);
    });
  });
});
