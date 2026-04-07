import type { ContractSchema, FieldSchema, TypeFrequency, InferenceConfig } from '../types/index.js';
import type { FieldStats } from './FieldStatsAccumulator.js';
import { EnumDetector } from './EnumDetector.js';

export class ContractSchemaBuilder {
  private readonly enumDetector: EnumDetector;

  constructor(enumDetector?: EnumDetector) {
    this.enumDetector = enumDetector ?? new EnumDetector();
  }

  buildSchema(
    fieldStatsMap: Map<string, FieldStats>,
    config: InferenceConfig,
    depth: number = 0,
  ): ContractSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [key, stats] of fieldStatsMap) {
      fields[key] = this.buildField(stats, config, depth);
    }

    return { _type: 'object', fields };
  }

  buildField(stats: FieldStats, config: InferenceConfig, depth: number): FieldSchema {
    const totalSamples = stats.totalSamples;
    const presence = totalSamples > 0 ? stats.presenceCount / totalSamples : 0;
    const required = presence >= config.requiredPresenceThreshold;
    const nullable = stats.nullCount > 0;
    const types = this.buildTypeFrequencies(stats);
    const enumValues = this.enumDetector.detect(stats, config);

    let nested: ContractSchema | undefined;
    if (stats.nestedStats && depth < config.maxDepth) {
      nested = this.buildSchema(stats.nestedStats, config, depth + 1);
    }

    let arrayItems: FieldSchema | undefined;
    if (stats.arrayItemStats && depth < config.maxDepth) {
      arrayItems = this.buildField(stats.arrayItemStats, config, depth + 1);
    }

    return {
      types,
      presence,
      required,
      nullable,
      enumValues,
      nested,
      arrayItems,
      sampleCount: stats.presenceCount,
    };
  }

  private buildTypeFrequencies(stats: FieldStats): TypeFrequency[] {
    const total = [...stats.typeCounts.values()].reduce((a, b) => a + b, 0);
    if (total === 0) return [];

    return [...stats.typeCounts.entries()]
      .map(([type, count]) => ({
        type,
        count,
        percentage: count / total,
      }))
      .sort((a, b) => b.count - a.count);
  }
}
