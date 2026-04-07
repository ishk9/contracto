import type { TransportConfig } from '@contractcheck/core';
import type { ITransportAdapter } from '../interfaces/index.js';
import { HttpTransport } from './HttpTransport.js';
import { NoopTransport } from './NoopTransport.js';

export class TransportFactory {
  static create(config: TransportConfig): ITransportAdapter {
    switch (config.type) {
      case 'http':
        return new HttpTransport(config.url!, config.timeout);
      case 'noop':
        return new NoopTransport();
      case 'sqs':
        throw new Error('SQS transport not yet implemented');
      case 'kafka':
        throw new Error('Kafka transport not yet implemented');
      default:
        throw new Error(`Unknown transport type: ${config.type}`);
    }
  }
}
