export interface ISchedulerJob {
  readonly name: string;
  readonly intervalMs: number;
  execute(): Promise<void>;
}

export interface IScheduler {
  register(job: ISchedulerJob): void;
  start(): void;
  stop(): void;
}
