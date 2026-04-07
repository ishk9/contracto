import type { ShapeNode } from '../types/index.js';

export interface IShapeExtractor {
  extract(value: unknown): ShapeNode;
}
