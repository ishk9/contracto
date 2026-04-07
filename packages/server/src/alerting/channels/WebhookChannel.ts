import type { DriftEvent } from '@contractcheck/core';
import type { IAlertChannel } from '../../interfaces/index.js';
import { PlainTextFormatter } from '../formatters/PlainTextFormatter.js';

export class WebhookChannel implements IAlertChannel {
  readonly name = 'webhook';
  private readonly formatter: PlainTextFormatter;

  constructor(
    private readonly url: string,
    formatter?: PlainTextFormatter,
  ) {
    this.formatter = formatter ?? new PlainTextFormatter();
  }

  async send(event: DriftEvent): Promise<void> {
    await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        message: this.formatter.format(event),
      }),
    }).catch(() => {});
  }
}
