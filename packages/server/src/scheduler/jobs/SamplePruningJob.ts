import type { ISampleStore } from '../../interfaces/index.js';
import type { ISchedulerJob } from '../../interfaces/index.js';

export class SamplePruningJob implements ISchedulerJob {
  readonly name = 'sample-pruning';
  readonly intervalMs = 60 * 60 * 1000;

  constructor(
    private readonly sampleStore: ISampleStore,
    private readonly retentionDays: number,
  ) {}

  async execute(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);
    this.sampleStore.pruneOlderThan(cutoff);
  }
}
