import type { ShapeNode } from '../types/index.js';

export interface IShapeMerger {
  merge(nodes: ShapeNode[]): ShapeNode;
}
