import type { ProviderBatch, ConsumerBatch } from '@contractcheck/core';

export interface ITransportAdapter {
  send(batch: ProviderBatch | ConsumerBatch): void;
  destroy(): void;
}
