import type { DriftEvent } from '@contractcheck/core';

export class PlainTextFormatter {
  format(event: DriftEvent): string {
    const consumers = event.affectedConsumers.length > 0
      ? event.affectedConsumers.map((c) => `  - ${c.consumer} (${c.field})`).join('\n')
      : '  (none)';

    return [
      `[${event.severity.toUpperCase()}] Contract Drift: ${event.changeType}`,
      `Provider: ${event.provider}`,
      `Endpoint: ${event.endpoint}`,
      `Field: ${event.field}`,
      `Change: ${event.details.before} -> ${event.details.after}`,
      `Description: ${event.details.description}`,
      `Affected Consumers:`,
      consumers,
      `First Seen: ${event.firstSeen}`,
    ].join('\n');
  }
}
