import type { IDriftStore } from '../../interfaces/index.js';
import type { ISchedulerJob } from '../../interfaces/index.js';
import type { DriftConfig } from '@contractcheck/core';

export class DriftResolutionJob implements ISchedulerJob {
  readonly name = 'drift-resolution';
  readonly intervalMs = 15 * 60 * 1000;

  constructor(
    private readonly driftStore: IDriftStore,
    private readonly config: DriftConfig,
  ) {}

  async execute(): Promise<void> {
    const activeEvents = this.driftStore.getActiveEvents();
    const now = Date.now();
    const maxAgeMs = this.config.autoResolveAfterHours * 60 * 60 * 1000;

    for (const event of activeEvents) {
      const lastSeenMs = new Date(event.lastSeen).getTime();
      if (now - lastSeenMs > maxAgeMs) {
        this.driftStore.updateEvent(event.id, {
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
        });
      }
    }
  }
}
