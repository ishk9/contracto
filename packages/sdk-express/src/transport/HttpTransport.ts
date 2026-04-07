import type { ProviderBatch, ConsumerBatch } from '@contractcheck/core';
import type { ITransportAdapter } from '../interfaces/index.js';

export class HttpTransport implements ITransportAdapter {
  constructor(
    private readonly serverUrl: string,
    private readonly timeoutMs: number = 3000,
  ) {}

  send(batch: ProviderBatch | ConsumerBatch): void {
    const isProvider = 'samples' in batch;
    const path = isProvider ? '/ingest/provider' : '/ingest/consumer';
    const url = `${this.serverUrl}${path}`;

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(this.timeoutMs),
    }).catch(() => {});
  }

  destroy(): void {}
}
