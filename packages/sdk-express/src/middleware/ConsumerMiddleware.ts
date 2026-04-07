import { BaseMiddleware } from './BaseMiddleware.js';
import { createTrackedFetch } from '../tracking/TrackedFetch.js';
import type { ConsumerReporter } from '../tracking/ConsumerReporter.js';

export class ConsumerMiddleware extends BaseMiddleware {
  private readonly consumerReporter: ConsumerReporter;
  private readonly serviceName: string;

  constructor(
    pipeline: ConstructorParameters<typeof BaseMiddleware>[0],
    reporter: ConstructorParameters<typeof BaseMiddleware>[1],
    consumerReporter: ConsumerReporter,
    serviceName: string,
  ) {
    super(pipeline, reporter);
    this.consumerReporter = consumerReporter;
    this.serviceName = serviceName;
  }

  protected intercept(req: any, _res: any, next: (err?: any) => void): void {
    req.ccFetch = createTrackedFetch(this.consumerReporter, this.serviceName);
    next();
  }
}
