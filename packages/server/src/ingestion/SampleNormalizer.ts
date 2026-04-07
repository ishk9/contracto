import type { ProviderBatch, ConsumerBatch } from '@contractcheck/core';

export interface NormalizedSample {
  endpoint: string;
  statusCode: number;
  shapeFingerprint: string;
  shape?: unknown;
  caller: string | null;
  count: number;
  timestamp: string;
}

export interface NormalizedAccess {
  provider: string;
  endpoint: string;
  fieldsAccessed: string[];
  count: number;
  timestamp: string;
}

export class SampleNormalizer {
  normalizeProviderBatch(batch: ProviderBatch): NormalizedSample[] {
    const grouped = new Map<string, NormalizedSample>();

    for (const sample of batch.samples) {
      const key = `${sample.endpoint}|${sample.shapeFingerprint}|${sample.statusCode}|${sample.caller ?? ''}`;

      const existing = grouped.get(key);
      if (existing) {
        existing.count += sample.count;
        if (sample.timestamp < existing.timestamp) {
          existing.timestamp = sample.timestamp;
        }
      } else {
        grouped.set(key, {
          endpoint: sample.endpoint,
          statusCode: sample.statusCode,
          shapeFingerprint: sample.shapeFingerprint,
          shape: sample.shape,
          caller: sample.caller,
          count: sample.count,
          timestamp: sample.timestamp,
        });
      }
    }

    return [...grouped.values()];
  }

  normalizeConsumerBatch(batch: ConsumerBatch): NormalizedAccess[] {
    const grouped = new Map<string, NormalizedAccess>();

    for (const access of batch.accesses) {
      const key = `${access.provider}|${access.endpoint}`;

      const existing = grouped.get(key);
      if (existing) {
        const fieldSet = new Set([...existing.fieldsAccessed, ...access.fieldsAccessed]);
        existing.fieldsAccessed = [...fieldSet];
        existing.count += access.count;
      } else {
        grouped.set(key, {
          provider: access.provider,
          endpoint: access.endpoint,
          fieldsAccessed: [...access.fieldsAccessed],
          count: access.count,
          timestamp: access.timestamp,
        });
      }
    }

    return [...grouped.values()];
  }
}
