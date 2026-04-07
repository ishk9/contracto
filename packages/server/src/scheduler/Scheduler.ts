import type { IScheduler, ISchedulerJob } from '../interfaces/index.js';

interface JobEntry {
  job: ISchedulerJob;
  timer: ReturnType<typeof setInterval> | null;
}

export class Scheduler implements IScheduler {
  private jobs = new Map<string, JobEntry>();
  private running = false;

  register(job: ISchedulerJob): void {
    this.jobs.set(job.name, { job, timer: null });
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    for (const [, entry] of this.jobs) {
      entry.timer = setInterval(async () => {
        try {
          await entry.job.execute();
        } catch {
          // Job errors are swallowed — never crash the scheduler
        }
      }, entry.job.intervalMs);
    }
  }

  stop(): void {
    this.running = false;
    for (const [, entry] of this.jobs) {
      if (entry.timer) {
        clearInterval(entry.timer);
        entry.timer = null;
      }
    }
  }
}
