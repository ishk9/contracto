import type { ShapeNode } from './ShapeNode.js';

export interface ProviderSample {
  readonly endpoint: string;
  readonly statusCode: number;
  readonly shapeFingerprint: string;
  readonly shape?: ShapeNode;
  readonly caller: string | null;
  readonly count: number;
  readonly timestamp: string;
}

export interface ProviderBatch {
  readonly sdk_version: string;
  readonly service: string;
  readonly samples: readonly ProviderSample[];
}

export interface ConsumerAccess {
  readonly provider: string;
  readonly endpoint: string;
  readonly fieldsAccessed: readonly string[];
  readonly count: number;
  readonly timestamp: string;
}

export interface ConsumerBatch {
  readonly sdk_version: string;
  readonly service: string;
  readonly accesses: readonly ConsumerAccess[];
}

export interface SampleAggregate {
  readonly id: string;
  readonly provider: string;
  readonly endpoint: string;
  readonly method: string;
  readonly shapeFingerprint: string;
  readonly caller: string | null;
  readonly statusCode: number;
  readonly count: number;
  readonly firstSeen: string;
  readonly lastSeen: string;
}
