import type { DriftEvent, DriftChangeType, Severity, DriftDetails, ConsumerImpact } from '../types/index.js';

type DriftEventDraft = {
  -readonly [K in keyof DriftEvent]?: DriftEvent[K];
};

export class DriftEventBuilder {
  private event: DriftEventDraft = {};

  static create(): DriftEventBuilder {
    return new DriftEventBuilder();
  }

  withId(id: string): this {
    this.event.id = id;
    return this;
  }

  withProvider(provider: string): this {
    this.event.provider = provider;
    return this;
  }

  withEndpoint(endpoint: string): this {
    this.event.endpoint = endpoint;
    return this;
  }

  withMethod(method: string): this {
    this.event.method = method;
    return this;
  }

  withChangeType(changeType: DriftChangeType): this {
    this.event.changeType = changeType;
    return this;
  }

  withSeverity(severity: Severity): this {
    this.event.severity = severity;
    return this;
  }

  withField(field: string): this {
    this.event.field = field;
    return this;
  }

  withDetails(details: DriftDetails): this {
    this.event.details = details;
    return this;
  }

  withConsumers(consumers: ConsumerImpact[]): this {
    this.event.affectedConsumers = consumers;
    return this;
  }

  build(): DriftEvent {
    const required = [
      'id',
      'provider',
      'endpoint',
      'method',
      'changeType',
      'severity',
      'field',
      'details',
      'affectedConsumers',
    ] as const;

    for (const key of required) {
      if (this.event[key] === undefined) {
        throw new Error(`DriftEvent missing required field: ${key}`);
      }
    }

    const now = new Date().toISOString();
    return {
      ...this.event,
      confirmationCount: 1,
      status: 'pending',
      firstSeen: now,
      lastSeen: now,
    } as DriftEvent;
  }
}
