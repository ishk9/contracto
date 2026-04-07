import type { ITransportAdapter } from '../interfaces/index.js';

export class NoopTransport implements ITransportAdapter {
  readonly batches: unknown[] = [];

  send(batch: unknown): void {
    this.batches.push(batch);
  }

  destroy(): void {}
}
