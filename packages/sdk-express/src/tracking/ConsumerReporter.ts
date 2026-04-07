import type { ConsumerBatch, ConsumerAccess } from '@contractcheck/core';

export interface ITransportAdapterLike {
  send(batch: unknown): void;
}

export class ConsumerReporter {
  private buffer: ConsumerAccess[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly transport: ITransportAdapterLike,
    private readonly service: string,
    flushIntervalMs: number = 5000,
  ) {
    this.flushTimer = setInterval(() => this.flush(), flushIntervalMs);
  }

  add(access: Omit<ConsumerAccess, 'count' | 'timestamp'>): void {
    const existing = this.buffer.find(
      (a) => a.provider === access.provider && a.endpoint === access.endpoint,
    );

    if (existing) {
      const merged = new Set([...existing.fieldsAccessed, ...access.fieldsAccessed]);
      (existing as any).fieldsAccessed = [...merged];
      (existing as any).count = (existing.count || 1) + 1;
    } else {
      this.buffer.push({
        ...access,
        count: 1,
        timestamp: new Date().toISOString(),
      } as ConsumerAccess);
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    const batch: ConsumerBatch = {
      sdk_version: '0.1.0',
      service: this.service,
      accesses: [...this.buffer],
    };

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
