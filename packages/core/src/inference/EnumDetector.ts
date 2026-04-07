import type { FieldStats } from './FieldStatsAccumulator.js';
import type { InferenceConfig } from '../types/index.js';

export class EnumDetector {
  detect(stats: FieldStats, config: InferenceConfig): string[] | undefined {
    if (stats.totalSamples < config.minSamplesForStable) return undefined;

    const stringCount = stats.typeCounts.get('string') ?? 0;
    if (stringCount === 0) return undefined;

    if (stats.stringValues.size === 0) return undefined;
    if (stats.stringValues.size > config.enumMaxCardinality) return undefined;

    const totalString = stats.stringValues.size;
    if (totalString <= 1) return undefined;

    return [...stats.stringValues.keys()].sort();
  }
}
