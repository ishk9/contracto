import type { ShapeNode } from '../types/index.js';
import { isShapeObject, isShapeArray, isShapeUnion, isPrimitive } from '../types/index.js';

export interface FieldStats {
  typeCounts: Map<string, number>;
  presenceCount: number;
  totalSamples: number;
  nullCount: number;
  stringValues: Map<string, number>;
  nestedStats: Map<string, FieldStats> | null;
  arrayItemStats: FieldStats | null;
}

export class FieldStatsAccumulator {
  create(totalSamples: number): FieldStats {
    return {
      typeCounts: new Map(),
      presenceCount: 0,
      totalSamples,
      nullCount: 0,
      stringValues: new Map(),
      nestedStats: null,
      arrayItemStats: null,
    };
  }

  accumulate(stats: FieldStats, node: ShapeNode): void {
    stats.presenceCount++;

    if (isPrimitive(node)) {
      const count = stats.typeCounts.get(node) ?? 0;
      stats.typeCounts.set(node, count + 1);

      if (node === 'null') {
        stats.nullCount++;
      }
      return;
    }

    if (isShapeObject(node)) {
      stats.typeCounts.set('object', (stats.typeCounts.get('object') ?? 0) + 1);

      if (!stats.nestedStats) stats.nestedStats = new Map();

      for (const [key, child] of Object.entries(node.fields)) {
        if (!stats.nestedStats.has(key)) {
          stats.nestedStats.set(key, this.create(stats.totalSamples));
        }
        this.accumulate(stats.nestedStats.get(key)!, child);
      }
      return;
    }

    if (isShapeArray(node)) {
      stats.typeCounts.set('array', (stats.typeCounts.get('array') ?? 0) + 1);

      if (!stats.arrayItemStats) {
        stats.arrayItemStats = this.create(stats.totalSamples);
      }
      this.accumulate(stats.arrayItemStats, node.items);
      return;
    }

    if (isShapeUnion(node)) {
      for (const variant of node.variants) {
        this.accumulate(stats, variant);
      }
    }
  }

  trackStringValue(stats: FieldStats, value: string): void {
    const count = stats.stringValues.get(value) ?? 0;
    stats.stringValues.set(value, count + 1);
  }
}
