import { ConflictException } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService (Unit)', () => {
  let service: IdempotencyService;

  beforeEach(() => {
    service = new IdempotencyService();
  });

  afterEach(() => {
    service.clear();
  });

  it('executes operation directly when no idempotency key is provided', async () => {
    const fn = jest.fn().mockResolvedValue({ id: '123' });
    const res = await service.execute({
      organizationId: 'org-1',
      payload: { name: 'test' },
      execute: fn,
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(res.result).toEqual({ id: '123' });
    expect(res.isIdempotentReplay).toBe(false);
  });

  it('returns cached response on identical payload replay', async () => {
    const fn = jest.fn().mockResolvedValue({ id: 'po-100', total: '500.0000' });

    // First execution
    const res1 = await service.execute({
      organizationId: 'org-1',
      idempotencyKey: 'idem-key-1',
      payload: { supplier: 'Acme', amount: 500 },
      execute: fn,
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(res1.isIdempotentReplay).toBe(false);
    expect(res1.result).toEqual({ id: 'po-100', total: '500.0000' });

    // Second execution with identical payload (even if key ordering is different)
    const res2 = await service.execute({
      organizationId: 'org-1',
      idempotencyKey: 'idem-key-1',
      payload: { amount: 500, supplier: 'Acme' },
      execute: fn,
    });

    expect(fn).toHaveBeenCalledTimes(1); // Not called again
    expect(res2.isIdempotentReplay).toBe(true);
    expect(res2.result).toEqual({ id: 'po-100', total: '500.0000' });
  });

  it('throws ConflictException when key is reused with differing payload', async () => {
    const fn = jest.fn().mockResolvedValue({ id: 'po-100' });

    await service.execute({
      organizationId: 'org-1',
      idempotencyKey: 'idem-key-1',
      payload: { supplier: 'Acme', amount: 500 },
      execute: fn,
    });

    await expect(
      service.execute({
        organizationId: 'org-1',
        idempotencyKey: 'idem-key-1',
        payload: { supplier: 'Acme', amount: 600 },
        execute: fn,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('isolates keys across different organizations', async () => {
    const fn1 = jest.fn().mockResolvedValue({ id: 'po-org1' });
    const fn2 = jest.fn().mockResolvedValue({ id: 'po-org2' });

    const res1 = await service.execute({
      organizationId: 'org-1',
      idempotencyKey: 'common-key',
      payload: { amount: 100 },
      execute: fn1,
    });

    const res2 = await service.execute({
      organizationId: 'org-2',
      idempotencyKey: 'common-key',
      payload: { amount: 100 },
      execute: fn2,
    });

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
    expect(res1.result).toEqual({ id: 'po-org1' });
    expect(res2.result).toEqual({ id: 'po-org2' });
  });
});
