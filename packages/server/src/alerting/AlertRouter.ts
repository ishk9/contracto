import type { DriftEvent } from '@contractcheck/core';
import type { IAlertChannel } from '../interfaces/index.js';

export class AlertRouter {
  private channels: IAlertChannel[] = [];

  register(channel: IAlertChannel): void {
    this.channels.push(channel);
  }

  async route(event: DriftEvent): Promise<void> {
    const results = await Promise.allSettled(
      this.channels.map((ch) => ch.send(event)),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        // Log but don't throw — one channel failure doesn't block others
      }
    }
  }

  getChannelCount(): number {
    return this.channels.length;
  }
}
