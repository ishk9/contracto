import type { ShapeNode, SampleAggregate } from '@contractcheck/core';

export interface ISampleReader {
  getShape(fingerprint: string): ShapeNode | null;
  getShapesByEndpoint(provider: string, endpoint: string, method: string): Array<{ fingerprint: string; shape: ShapeNode; count: number }>;
  getAggregates(provider: string, endpoint: string, method: string): SampleAggregate[];
}

export interface ISampleWriter {
  storeShape(fingerprint: string, shape: ShapeNode): void;
  upsertAggregate(aggregate: Omit<SampleAggregate, 'id'>): void;
  pruneOlderThan(date: Date): number;
}

export type ISampleStore = ISampleReader & ISampleWriter;
