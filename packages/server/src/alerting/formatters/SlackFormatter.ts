import type { DriftEvent, Severity } from '@contractcheck/core';

const SEVERITY_EMOJI: Record<Severity, string> = {
  info: ':information_source:',
  warning: ':warning:',
  breaking: ':red_circle:',
  critical: ':skull:',
};

export interface SlackMessage {
  text: string;
  blocks: unknown[];
}

export class SlackFormatter {
  format(event: DriftEvent): SlackMessage {
    const emoji = SEVERITY_EMOJI[event.severity];
    const text = `${emoji} [${event.severity.toUpperCase()}] ${event.changeType} on ${event.provider} ${event.endpoint}`;

    const consumers = event.affectedConsumers.length > 0
      ? event.affectedConsumers.map((c) => `• ${c.consumer} (reads \`${c.field}\`)`).join('\n')
      : '_No consumers affected_';

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${emoji} Contract Drift Detected` },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Provider:*\n${event.provider}` },
          { type: 'mrkdwn', text: `*Endpoint:*\n${event.endpoint}` },
          { type: 'mrkdwn', text: `*Change:*\n${event.changeType}` },
          { type: 'mrkdwn', text: `*Severity:*\n${event.severity.toUpperCase()}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Field:* \`${event.field}\`\n*Before:* ${event.details.before}\n*After:* ${event.details.after}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Affected Consumers:*\n${consumers}` },
      },
    ];

    return { text, blocks };
  }
}
