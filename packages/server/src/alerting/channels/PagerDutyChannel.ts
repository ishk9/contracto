import type { DriftEvent, Severity } from '@contractcheck/core';
import type { IAlertChannel } from '../../interfaces/index.js';

const SEVERITY_ORDER: Record<Severity, number> = {
  info: 0,
  warning: 1,
  breaking: 2,
  critical: 3,
};

const PD_SEVERITY: Record<Severity, string> = {
  info: 'info',
  warning: 'warning',
  breaking: 'error',
  critical: 'critical',
};

export class PagerDutyChannel implements IAlertChannel {
  readonly name = 'pagerduty';

  constructor(
    private readonly routingKey: string,
    private readonly severityThreshold: Severity,
  ) {}

  async send(event: DriftEvent): Promise<void> {
    if (SEVERITY_ORDER[event.severity] < SEVERITY_ORDER[this.severityThreshold]) {
      return;
    }

    const payload = {
      routing_key: this.routingKey,
      event_action: 'trigger',
      payload: {
        summary: `Contract drift: ${event.changeType} on ${event.provider} ${event.endpoint} (${event.field})`,
        severity: PD_SEVERITY[event.severity],
        source: 'contractcheck',
        component: event.provider,
        group: event.endpoint,
        custom_details: {
          field: event.field,
          before: event.details.before,
          after: event.details.after,
          consumers: event.affectedConsumers.map((c) => c.consumer),
        },
      },
    };

    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
}
