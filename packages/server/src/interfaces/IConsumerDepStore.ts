import type { ConsumerDep, DependencyGraph } from '@contractcheck/core';

export interface IConsumerDepReader {
  getConsumersOf(provider: string, endpoint: string, method: string): ConsumerDep[];
  getDependenciesOf(consumer: string): ConsumerDep[];
  getFullGraph(): DependencyGraph;
}

export interface IConsumerDepWriter {
  upsertDep(dep: ConsumerDep): void;
  markStale(olderThan: Date): number;
}

export type IConsumerDepStore = IConsumerDepReader & IConsumerDepWriter;
