import type { ProviderSample, ProviderBatch } from '@contractcheck/core';
import type { ITransportAdapter } from '../interfaces/index.js';

export class ShapeReporter {
  private buffer: ProviderSample[] = [];
  private seenFingerprints = new Set<string>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly flushThreshold = 100;

  constructor(
    private readonly transport: ITransportAdapter,
    private readonly service: string,
    private readonly maxBufferSize: number = 10000,
    flushIntervalMs: number = 5000,
  ) {
    this.flushTimer = setInterval(() => this.flush(), flushIntervalMs);
  }

  add(sample: {
    endpoint: string;
    statusCode: number;
    shapeFingerprint: string;
    shape?: unknown;
    caller: string | null;
    count: number;
    timestamp: string;
  }): void {
    const existing = this.buffer.find(
      (s) => s.endpoint === sample.endpoint && s.shapeFingerprint === sample.shapeFingerprint,
    );

    if (existing) {
      (existing as any).count = existing.count + sample.count;
      return;
    }

    const entry: ProviderSample = {
      endpoint: sample.endpoint,
      statusCode: sample.statusCode,
      shapeFingerprint: sample.shapeFingerprint,
      shape: this.seenFingerprints.has(sample.shapeFingerprint) ? undefined : (sample.shape as any),
      caller: sample.caller,
      count: sample.count,
      timestamp: sample.timestamp,
    };

    this.buffer.push(entry);

    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(Math.floor(this.maxBufferSize / 2));
    }

    if (this.buffer.length >= this.flushThreshold) {
      this.flush();
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    const batch: ProviderBatch = {
      sdk_version: '0.1.0',
      service: this.service,
      samples: [...this.buffer],
    };

    for (const sample of this.buffer) {
      this.seenFingerprints.add(sample.shapeFingerprint);
    }

    this.buffer = [];
    this.transport.send(batch);
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}
