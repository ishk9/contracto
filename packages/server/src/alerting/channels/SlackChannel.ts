import type { DriftEvent } from '@contractcheck/core';
import type { IAlertChannel } from '../../interfaces/index.js';
import { SlackFormatter } from '../formatters/SlackFormatter.js';

export class SlackChannel implements IAlertChannel {
  readonly name = 'slack';
  private readonly webhookUrl: string;
  private readonly formatter: SlackFormatter;

  constructor(webhookUrl: string, formatter?: SlackFormatter) {
    this.webhookUrl = webhookUrl;
    this.formatter = formatter ?? new SlackFormatter();
  }

  async send(event: DriftEvent): Promise<void> {
    const message = this.formatter.format(event);
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    }).catch(() => {});
  }
}
