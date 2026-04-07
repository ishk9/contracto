import type { ProviderBatch, ConsumerBatch } from '@contractcheck/core';

export class BatchValidator {
  validateProviderBatch(batch: unknown): ProviderBatch {
    if (!batch || typeof batch !== 'object') {
      throw new Error('Invalid batch: must be an object');
    }

    const b = batch as Record<string, unknown>;

    if (typeof b.service !== 'string' || !b.service) {
      throw new Error('Invalid batch: missing service name');
    }
    if (!Array.isArray(b.samples) || b.samples.length === 0) {
      throw new Error('Invalid batch: samples must be a non-empty array');
    }

    for (const sample of b.samples) {
      if (typeof sample !== 'object' || !sample) {
        throw new Error('Invalid sample: must be an object');
      }
      const s = sample as Record<string, unknown>;
      if (typeof s.endpoint !== 'string') throw new Error('Invalid sample: missing endpoint');
      if (typeof s.shapeFingerprint !== 'string') throw new Error('Invalid sample: missing shapeFingerprint');
      if (typeof s.statusCode !== 'number') throw new Error('Invalid sample: missing statusCode');
    }

    return batch as ProviderBatch;
  }

  validateConsumerBatch(batch: unknown): ConsumerBatch {
    if (!batch || typeof batch !== 'object') {
      throw new Error('Invalid batch: must be an object');
    }

    const b = batch as Record<string, unknown>;

    if (typeof b.service !== 'string' || !b.service) {
      throw new Error('Invalid batch: missing service name');
    }
    if (!Array.isArray(b.accesses) || b.accesses.length === 0) {
      throw new Error('Invalid batch: accesses must be a non-empty array');
    }

    return batch as ConsumerBatch;
  }
}
