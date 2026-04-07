import type { ShapeNode } from '../types/index.js';
import type { IShapeExtractor } from '../interfaces/index.js';
import type { IShapeMerger } from '../interfaces/index.js';
import { ShapeMerger } from './ShapeMerger.js';

const MAX_ARRAY_SAMPLE = 10;

export class ShapeExtractor implements IShapeExtractor {
  private readonly maxDepth: number;
  private readonly merger: IShapeMerger;

  constructor(options?: { maxDepth?: number; merger?: IShapeMerger }) {
    this.maxDepth = options?.maxDepth ?? 10;
    this.merger = options?.merger ?? new ShapeMerger();
  }

  extract(value: unknown): ShapeNode {
    return this.extractAtDepth(value, 0);
  }

  private extractAtDepth(value: unknown, depth: number): ShapeNode {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';

    const type = typeof value;

    if (type === 'string') return 'string';
    if (type === 'number') return 'number';
    if (type === 'boolean') return 'boolean';

    if (depth >= this.maxDepth) {
      return Array.isArray(value) ? 'unknown' : 'unknown';
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return { _type: 'array', items: 'unknown' };
      }
      const sampled = value.slice(0, MAX_ARRAY_SAMPLE);
      const itemShapes = sampled.map((item) => this.extractAtDepth(item, depth + 1));
      return { _type: 'array', items: this.merger.merge(itemShapes) };
    }

    if (type === 'object') {
      const obj = value as Record<string, unknown>;
      const fields: Record<string, ShapeNode> = {};
      for (const key of Object.keys(obj)) {
        fields[key] = this.extractAtDepth(obj[key], depth + 1);
      }
      return { _type: 'object', fields };
    }

    return 'unknown';
  }
}
