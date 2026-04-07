import type { IConsumerDepStore } from '../../interfaces/index.js';
import type { ISchedulerJob } from '../../interfaces/index.js';

export class StaleConsumerJob implements ISchedulerJob {
  readonly name = 'stale-consumer';
  readonly intervalMs = 24 * 60 * 60 * 1000;

  constructor(
    private readonly consumerDepStore: IConsumerDepStore,
    private readonly staleDays: number = 30,
  ) {}

  async execute(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.staleDays);
    this.consumerDepStore.markStale(cutoff);
  }
}
