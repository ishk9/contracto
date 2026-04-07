import type { ProviderBatch, ConsumerBatch } from '@contractcheck/core';
import type { ISampleStore } from '../interfaces/index.js';
import type { IConsumerDepStore } from '../interfaces/index.js';
import type { EventBus } from '../events/index.js';
import { SampleNormalizer } from './SampleNormalizer.js';

export class IngestionService {
  private readonly sampleStore: ISampleStore;
  private readonly consumerDepStore: IConsumerDepStore;
  private readonly eventBus: EventBus;
  private readonly normalizer: SampleNormalizer;

  constructor(
    sampleStore: ISampleStore,
    consumerDepStore: IConsumerDepStore,
    eventBus: EventBus,
  ) {
    this.sampleStore = sampleStore;
    this.consumerDepStore = consumerDepStore;
    this.eventBus = eventBus;
    this.normalizer = new SampleNormalizer();
  }

  ingestProviderBatch(
    batch: ProviderBatch,
  ): { stored: number; missingFingerprints: string[] } {
    const normalized = this.normalizer.normalizeProviderBatch(batch);
    const missingFingerprints: string[] = [];
    let stored = 0;

    for (const sample of normalized) {
      if (sample.shape) {
        this.sampleStore.storeShape(sample.shapeFingerprint, sample.shape as any);
      } else {
        const existing = this.sampleStore.getShape(sample.shapeFingerprint);
        if (!existing) {
          missingFingerprints.push(sample.shapeFingerprint);
        }
      }

      const [method, ...endpointParts] = sample.endpoint.split(' ');
      const endpoint = endpointParts.join(' ') || sample.endpoint;

      this.sampleStore.upsertAggregate({
        provider: batch.service,
        endpoint,
        method: method || 'GET',
        shapeFingerprint: sample.shapeFingerprint,
        caller: sample.caller,
        statusCode: sample.statusCode,
        count: sample.count,
        firstSeen: sample.timestamp,
        lastSeen: sample.timestamp,
      });

      this.eventBus.emit('sample:ingested', {
        provider: batch.service,
        endpoint,
        method: method || 'GET',
        fingerprint: sample.shapeFingerprint,
      });

      stored++;
    }

    return { stored, missingFingerprints };
  }

  ingestConsumerBatch(batch: ConsumerBatch): void {
    const normalized = this.normalizer.normalizeConsumerBatch(batch);
    const now = new Date().toISOString();

    for (const access of normalized) {
      const [method, ...endpointParts] = access.endpoint.split(' ');
      const endpoint = endpointParts.join(' ') || access.endpoint;

      this.consumerDepStore.upsertDep({
        consumer: batch.service,
        provider: access.provider,
        endpoint,
        method: method || 'GET',
        fieldsAccessed: access.fieldsAccessed,
        sampleCount: access.count,
        firstSeen: access.timestamp || now,
        lastSeen: access.timestamp || now,
      });
    }
  }
}
