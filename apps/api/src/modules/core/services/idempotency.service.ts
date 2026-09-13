import { Injectable, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';

interface StoredIdempotencyRecord {
  payloadHash: string;
  response: unknown;
  createdAt: number;
}

@Injectable()
export class IdempotencyService {
  private readonly cache = new Map<string, StoredIdempotencyRecord>();
  private readonly TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Hashes a payload canonically to avoid key ordering differences.
   */
  public static hashPayload(payload: unknown): string {
    const canonicalJson = this.stringifyCanonical(payload);
    return createHash('sha256').update(canonicalJson).digest('hex');
  }

  public hashPayload(payload: unknown): string {
    return IdempotencyService.hashPayload(payload);
  }

  /**
   * Executes an operation with tenant-isolated idempotency semantics.
   */
  async execute<T>(params: {
    organizationId: string;
    idempotencyKey?: string | undefined;
    payload: unknown;
    execute: () => Promise<T>;
  }): Promise<{ result: T; isIdempotentReplay: boolean }> {
    const { organizationId, idempotencyKey, payload, execute } = params;

    if (!idempotencyKey) {
      const result = await execute();
      return { result, isIdempotentReplay: false };
    }

    const cacheKey = `${organizationId}:${idempotencyKey}`;
    const payloadHash = this.hashPayload(payload);

    const existing = this.cache.get(cacheKey);
    if (existing) {
      if (existing.payloadHash === payloadHash) {
        return { result: existing.response as T, isIdempotentReplay: true };
      }
      throw new ConflictException(
        'Idempotency key was previously used with different request parameters',
      );
    }

    const result = await execute();

    this.cache.set(cacheKey, {
      payloadHash,
      response: result,
      createdAt: Date.now(),
    });

    return { result, isIdempotentReplay: false };
  }

  /**
   * Deterministically stringifies an object with sorted keys.
   */
  public static stringifyCanonical(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return `[${obj.map((item) => this.stringifyCanonical(item)).join(',')}]`;
    }
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys.map(
      (k) => `${JSON.stringify(k)}:${this.stringifyCanonical((obj as Record<string, unknown>)[k])}`,
    );
    return `{${pairs.join(',')}}`;
  }

  /**
   * Clears expired records or all records (useful for test resets).
   */
  public clear(): void {
    this.cache.clear();
  }
}
