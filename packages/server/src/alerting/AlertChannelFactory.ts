import type { AlertConfig } from '../config/index.js';
import type { IAlertChannel } from '../interfaces/index.js';
import { SlackChannel } from './channels/SlackChannel.js';
import { PagerDutyChannel } from './channels/PagerDutyChannel.js';
import { WebhookChannel } from './channels/WebhookChannel.js';

export class AlertChannelFactory {
  static createAll(config: AlertConfig): IAlertChannel[] {
    const channels: IAlertChannel[] = [];

    if (config.slack) {
      channels.push(new SlackChannel(config.slack.webhookUrl));
    }
    if (config.pagerduty) {
      channels.push(
        new PagerDutyChannel(config.pagerduty.routingKey, config.pagerduty.severityThreshold),
      );
    }
    if (config.webhook) {
      channels.push(new WebhookChannel(config.webhook.url));
    }

    return channels;
  }
}
